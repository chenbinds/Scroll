/**
 * MOBI/AZW3 parser using Koodo Reader's proven decompression engine.
 * https://github.com/koodo-reader/kookit/blob/main/src/libs/mobi.js
 */

// ── Koodo Reader functions ─────────────────────────────────────────

const getString = (b: Uint8Array) => new TextDecoder().decode(b)
function getUint(b: Uint8Array, size?: number): number {
  const sz = size ?? b.length
  if (sz === 0) return 0
  if (sz === 1) return b[0]
  const v = new DataView(b.buffer, b.byteOffset, sz)
  return sz >= 4 ? v.getUint32(0, false) : v.getUint16(0, false)
}

const PALMDOC_HEADER = { compression: [0,2,'uint'], numTextRecords: [8,2,'uint'], recordSize: [10,2,'uint'], encryption: [12,2,'uint'] }
const MOBI_HEADER_DEF = { magic: [16,4,'string'], length: [20,4,'uint'], type: [24,4,'uint'], encoding: [28,4,'uint'], uid: [32,4,'uint'], version: [36,4,'uint'], titleOffset: [84,4,'uint'], titleLength: [88,4,'uint'], localeRegion: [94,1,'uint'], localeLanguage: [95,1,'uint'], resourceStart: [108,4,'uint'], huffcdic: [112,4,'uint'], numHuffcdic: [116,4,'uint'], exthFlag: [128,4,'uint'], trailingFlags: [240,4,'uint'], indx: [244,4,'uint'] }
const EXTH_HEADER = { magic: [0,4,'string'], length: [4,4,'uint'], count: [8,4,'uint'] }
const HUFF_HEADER = { magic: [0,4,'string'], offset1: [8,4,'uint'], offset2: [12,4,'uint'] }
const CDIC_HEADER = { magic: [0,4,'string'], length: [4,4,'uint'], numEntries: [8,4,'uint'], codeLength: [12,4,'uint'] }
const MOBI_ENCODING: Record<number, string> = { 1252: 'windows-1252', 65001: 'utf-8' }

type StructDef = Record<string, [number, number, string]>

function getStruct(def: StructDef, buf: Uint8Array): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [name, [offset, size, type]] of Object.entries(def)) {
    if (offset + size > buf.length) { result[name] = type === 'string' ? '' : 0xFFFFFFFF; continue }
    const slice = buf.slice(offset, offset + size)
    result[name] = type === 'string' ? getString(slice).replace(/\0/g, '').trim() : getUint(slice, size)
  }
  return result
}

// ── PalmDOC LZ77 (Koodo Reader) ────────────────────────────────────

function decompressPalmDOC(array: Uint8Array): Uint8Array {
  const output: number[] = []
  for (let i = 0; i < array.length; i++) {
    const byte = array[i]
    if (byte === 0) output.push(0)
    else if (byte <= 8) for (const x of array.subarray(i + 1, (i += byte) + 1)) output.push(x)
    else if (byte <= 0b0111_1111) output.push(byte)
    else if (byte <= 0b1011_1111) {
      const bytes = (byte << 8) | array[i++ + 1]
      const distance = (bytes & 0b0011_1111_1111_1111) >>> 3
      const length = (bytes & 0b111) + 3
      for (let j = 0; j < length; j++) output.push(output[output.length - distance])
    }
    else output.push(32, byte ^ 0b1000_0000)
  }
  return Uint8Array.from(output)
}

// ── HUFF/CDIC ──────────────────────────────────────────────────────

function countBitsSet(x: number): number { let c = 0; for (; x > 0; x = x >>> 1) if ((x & 1) === 1) c++; return c }

function getVarLenFromEnd(array: Uint8Array): number {
  let value = 0, bytesRead = 0
  for (let i = array.length - 1; i >= 0; i--) {
    const byte = array[i]; value = (byte & 0x7F) << (7 * bytesRead) | value; bytesRead++
    if (byte & 0x80) break
  }
  return value + bytesRead
}

function huffcdicLoad(reader: any, huffRecord: Uint8Array, cdicRecords: Uint8Array[]): void {
  const h = getStruct(HUFF_HEADER, huffRecord)
  reader.dict1 = Array.from({ length: 256 }, (_, i) => h.offset1 + 4 * i)
    .map(off => off + 4 <= huffRecord.length ? getUint(huffRecord.slice(off, off + 4)) : 0)
    .map((v: number) => [!!(v & 0x80), v & 0x1F, v >>> 8])
  for (const cdicRecord of cdicRecords) {
    const c = getStruct(CDIC_HEADER, cdicRecord)
    if (c.magic !== 'CDIC') continue
    const n = Math.min(1 << c.codeLength, c.numEntries - (reader.dictionary?.length ?? 0))
    for (let i = 0; i < n; i++) {
      const idx = 16 + 2 * i; if (idx + 2 > cdicRecord.length) continue
      const off = getUint(cdicRecord.slice(idx, idx + 2)) & 0xFFFF
      const blenIdx = 16 + off; if (blenIdx + 2 > cdicRecord.length) continue
      const blen = getUint(cdicRecord.slice(blenIdx, blenIdx + 2)) & 0xFFFF
      const len = blen & 0x7FFF; const flag = blen & 0x8000
      const dataStart = 18 + off; if (dataStart + len > cdicRecord.length) continue
      reader.dictionary.push(cdicRecord.slice(dataStart, dataStart + len))
      reader.dictionaryFlags.push(flag)
    }
  }
}

function huffUnpackData(reader: any, data: Uint8Array, depth: number = 0): Uint8Array {
  if (depth > 5) return new Uint8Array(0)
  const padded = new Uint8Array(data.length + 8); padded.set(data)
  const q = new DataView(padded.buffer, padded.byteOffset, padded.length)
  const output: number[] = []
  let pos = 0, x = q.getBigUint64(pos, false), n = 32, bitsLeft = data.length * 8
  while (bitsLeft >= 0) {
    if (n <= 0) { pos += 4; x = q.getBigUint64(pos, false); n += 32 }
    const code = Number(x >> BigInt(n))
    const top8 = (code >>> 24) & 0xFF
    const [term, codelen, maxcodeRaw] = reader.dict1[top8] || [1, 1, 0]
    let maxcode = ((maxcodeRaw + 1) << (32 - codelen)) - 1
    n -= codelen; bitsLeft -= codelen
    if (bitsLeft < 0) break
    const r = (maxcode - code) >>> (32 - codelen)
    if (r < 0 || r >= (reader.dictionary?.length ?? 0)) continue
    const entry = reader.dictionary[r], flag = reader.dictionaryFlags?.[r]
    if (entry) {
      if (flag) { for (let j = 0; j < entry.length; j++) output.push(entry[j]) }
      else { reader.dictionary[r] = null; const nested = huffUnpackData(reader, entry, depth + 1); reader.dictionary[r] = nested; reader.dictionaryFlags[r] = 0x8000; for (let j = 0; j < nested.length; j++) output.push(nested[j]) }
    }
  }
  return new Uint8Array(output)
}

// ── EXTH Parsing ──────────────────────────────────────────────────

const EXTH_RECORD_NAMES: Record<number, [string, string, boolean]> = {
  100: ['creator', 'string', true], 101: ['publisher', 'string', false], 103: ['description', 'string', false],
  104: ['isbn', 'string', false], 105: ['subject', 'string', true], 106: ['date', 'string', false],
  108: ['contributor', 'string', false], 112: ['asin', 'string', false], 113: ['version', 'string', false],
  129: ['cover', 'string', false], 201: ['coverOffset', 'uint', false], 202: ['thumbOffset', 'uint', false],
  501: ['cdetype', 'string', false], 503: ['title', 'string', false], 524: ['language', 'string', false],
  121: ['boundary', 'uint', false], 125: ['numResources', 'uint', false],
}

function parseExthData(buf: Uint8Array, encoding: number): Record<string, any> {
  const header = getStruct(EXTH_HEADER, buf)
  if (header.magic !== 'EXTH') return {}
  const decode = new TextDecoder(MOBI_ENCODING[encoding] || 'windows-1252')
  const results: Record<string, any> = {}
  let offset = 12
  for (let i = 0; i < header.count && offset + 8 <= header.length; i++) {
    const type = getUint(buf.slice(offset, offset + 4))
    const len = getUint(buf.slice(offset + 4, offset + 8))
    const data = buf.slice(offset + 8, offset + len)
    const rd = EXTH_RECORD_NAMES[type]
    if (rd) {
      const [name, dt, isArr] = rd
      const value = dt === 'string' ? decode.decode(data).replace(/\0/g, '').trim() : getUint(data)
      if (isArr) { if (!results[name]) results[name] = []; (results[name] as any[]).push(value) }
      else results[name] = value
    }
    offset += len
  }
  return results
}

// ── Public API ────────────────────────────────────────────────────

export interface MobiMetadata { title: string; author: string }
export interface MobiChapter { title: string; html: string }
export interface MobiContent { metadata: MobiMetadata; chapters: MobiChapter[] }

export async function parseMobi(base64Data: string): Promise<MobiContent> {
  const binaryStr = atob(base64Data)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)

  if (bytes.length < 78) throw new Error('File too small for PDB header')

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length)
  const numRecords = view.getUint16(76, false)
  if (numRecords === 0) throw new Error('Empty PDB file')

  const recordOffsets: number[] = []
  const maxRecOffset = 78 + numRecords * 8
  if (maxRecOffset > bytes.length) throw new Error('Record offset table exceeds file size')
  for (let i = 0; i < numRecords; i++) recordOffsets.push(view.getUint32(78 + i * 8, false))
  // Validate all record offsets are within file bounds
  for (let i = 0; i < numRecords; i++) {
    if (recordOffsets[i] > bytes.length) throw new Error(`Record ${i} offset ${recordOffsets[i]} exceeds file size ${bytes.length}`)
  }
  const readRecord = (i: number) => bytes.slice(recordOffsets[i], i + 1 < numRecords ? recordOffsets[i + 1] : bytes.length)

  const record0 = readRecord(0)
  const palmdoc = getStruct(PALMDOC_HEADER, record0)
  const mobi = getStruct(MOBI_HEADER_DEF, record0)
  if (mobi.magic !== 'MOBI') throw new Error('Not a valid MOBI file')

  const compression = palmdoc.compression as number
  const encoding = mobi.encoding as number
  // Use PalmDOC header's numTextRecords for text record count (Koodo approach)
  const numTextRecords = palmdoc.numTextRecords as number
  const trailingFlags = (mobi.trailingFlags as number) ?? 0xFFFFFFFF
  const exthFlag = mobi.exthFlag as number

  const decode = new TextDecoder(MOBI_ENCODING[encoding] || 'windows-1252')
  const titleOffset = mobi.titleOffset as number
  const titleLength = mobi.titleLength as number
  let title = 'Untitled'
  if (titleOffset > 0 && titleOffset + titleLength <= record0.length)
    title = decode.decode(record0.slice(titleOffset, titleOffset + titleLength)).replace(/\0/g, '').trim()

  const mobiLen = mobi.length as number
  const exthData = (exthFlag & 0x40) ? parseExthData(record0.slice(mobiLen + 16), encoding) : {}
  if (!title || title === 'Untitled') title = exthData.title || title
  const author = exthData.creator?.join(', ') || 'Unknown Author'

  const firstTextIdx = 1
  const lastTextIdx = 1 + (numTextRecords > 0 ? numTextRecords : numRecords - 1)

  const tf = (trailingFlags === 0xFFFFFFFF || trailingFlags === 0) ? 0 : trailingFlags
  const numTrailing = countBitsSet(tf >>> 1), multibyte = tf & 1

  const allOutput: number[] = []

  if (compression === 17480) {
    // Search entire file for HUFF and CDIC records (KF8 files store them after text records)
    let huffRecord: Uint8Array | null = null
    const cdicRecords: Uint8Array[] = []
    for (let ri = 0; ri < numRecords; ri++) {
      const data = readRecord(ri)
      if (data.length < 4) continue
      const tag = getString(data.slice(0, 4))
      if (tag === 'HUFF') huffRecord = data; else if (tag === 'CDIC') cdicRecords.push(data)
    }
    if (!huffRecord) throw new Error('HUFF/CDIC: HUFF record not found')
    const reader: any = { dictionary: [], dictionaryFlags: [] }
    huffcdicLoad(reader, huffRecord, cdicRecords)
    for (let ri = firstTextIdx; ri < lastTextIdx; ri++) {
      const decoded = huffUnpackData(reader, readRecord(ri))
      for (let j = 0; j < decoded.length; j++) allOutput.push(decoded[j])
    }
  } else if (compression === 2) {
    if (tf !== 0) {
      for (let ri = firstTextIdx; ri < lastTextIdx; ri++) {
        let data = readRecord(ri)
        for (let k = 0; k < numTrailing; k++) { const l = getVarLenFromEnd(data); if (l > 0 && l <= data.length) data = data.slice(0, -l) }
        if (multibyte && data.length > 0) { const m = (data[data.length - 1] & 3) + 1; if (m > 0 && m < data.length) data = data.slice(0, -m) }
        if (data.length === 0) continue
        const decoded = decompressPalmDOC(data)
        for (let j = 0; j < decoded.length; j++) allOutput.push(decoded[j])
      }
    } else {
      const concat: number[] = []
      for (let ri = firstTextIdx; ri < lastTextIdx; ri++) { const data = readRecord(ri); for (let j = 0; j < data.length; j++) concat.push(data[j]) }
      const decoded = decompressPalmDOC(new Uint8Array(concat))
      for (let j = 0; j < decoded.length; j++) allOutput.push(decoded[j])
    }
  }

  let html = decode.decode(new Uint8Array(allOutput))

  if (html.includes('<?xml')) {
    const parts = html.split(/<\?xml[^?]*\?>/)
    const bodies: string[] = []
    for (const part of parts) {
      let content = part.replace(/<\/?html[^>]*>/gi, '').replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '').trim()
      if (content.length > 10) bodies.push(content)
    }
    if (bodies.length > 1) html = bodies.join('\n')
  }

  html = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<mbp:pagebreak[^>]*\/?>/gi, '').replace(/<a[^>]*filepos=\d+[^>]*>[\s\S]*?<\/a>/gi, '').replace(/<a[^>]*>\s*<\/a>/gi, '').replace(/�/g, '').trim()

  const chapters: MobiChapter[] = []
  const headingPattern = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi
  let m: RegExpExecArray | null
  const headingMatches: { pos: number; heading: string }[] = []
  while ((m = headingPattern.exec(html)) !== null) { const h = m[1].replace(/<[^>]+>/g, '').trim(); if (h) headingMatches.push({ pos: m.index, heading: h }) }
  if (headingMatches.length > 0) {
    for (let i = 0; i < headingMatches.length; i++) {
      const start = headingMatches[i].pos, end = i + 1 < headingMatches.length ? headingMatches[i + 1].pos : html.length
      let chunk = html.slice(start, end).replace(/<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>/i, '')
      chapters.push({ title: headingMatches[i].heading, html: chunk })
    }
  } else {
    chapters.push({ title, html })
  }

  return { metadata: { title, author }, chapters }
}
