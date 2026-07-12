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
  // table1: indexed by top 8 bits of Huffman code
  reader.table1 = Array.from({ length: 256 }, (_, i) => h.offset1 + 4 * i)
    .map(off => off + 4 <= huffRecord.length ? getUint(huffRecord.slice(off, off + 4)) : 0)
    .map((v: number) => [!!(v & 0x80), v & 0x1F, v >>> 8])
  // table2: indexed by code length (1-32), each [mincode, value]
  const t2: [number, number][] = []
  for (let i = 0; i < 32; i++) {
    const off = h.offset2 + i * 8
    if (off + 8 <= huffRecord.length) {
      t2.push([getUint(huffRecord.slice(off, off + 4)), getUint(huffRecord.slice(off + 4, off + 8))])
    } else {
      t2.push([0, 0])
    }
  }
  reader.table2 = t2
  // Build dictionary from CDIC records
  for (const cdicRecord of cdicRecords) {
    const c = getStruct(CDIC_HEADER, cdicRecord)
    if (c.magic !== 'CDIC') continue
    const n = Math.min(1 << c.codeLength, c.numEntries - (reader.dictionary?.length ?? 0))
    const buffer = cdicRecord.slice(c.length as number) // data starts after header
    for (let i = 0; i < n; i++) {
      const offset = getUint(buffer.slice(i * 2, i * 2 + 2))
      if (offset + 2 > buffer.length) continue
      const x = getUint(buffer.slice(offset, offset + 2))
      const len = x & 0x7FFF; const decompressed = x & 0x8000
      if (offset + 2 + len > buffer.length) continue
      const value = buffer.slice(offset + 2, offset + 2 + len)
      reader.dictionary.push([value, decompressed])
    }
  }
}

// Koodo Reader's exact bit reader: read 32-bit window at given bit position
function read32Bits(byteArray: Uint8Array, from: number): bigint {
  const startByte = from >>> 3
  const end = from + 32
  const endByte = end >>> 3
  let bits = 0n
  for (let i = startByte; i <= endByte; i++)
    bits = (bits << 8n) | BigInt(byteArray[i] ?? 0)
  return (bits >> (8n - BigInt(end & 7))) & 0xFFFFFFFFn
}

// Koodo Reader's exact Huffman decoder: table1 + table2 + dictionary
function huffUnpackData(reader: any, data: Uint8Array, depth: number = 0): Uint8Array {
  if (depth > 10) return new Uint8Array(0) // safety: max recursion depth
  const output: number[] = []
  const bitLength = data.byteLength * 8
  let i = 0
  while (i < bitLength) {
    const bits = Number(read32Bits(data, i))
    let [found, codeLength, value] = reader.table1[bits >>> 24]
    if (!found) {
      // Use table2 to find the correct code length
      const t2 = reader.table2
      while (codeLength < 32 && (bits >>> (32 - codeLength)) < (t2[codeLength - 1]?.[0] ?? 0))
        codeLength += 1
      value = t2[codeLength - 1]?.[1] ?? 0
    }
    if ((i += codeLength) > bitLength) break

    const code = value - (bits >>> (32 - codeLength))
    if (code < 0 || code >= reader.dictionary.length) continue
    let [result, decompressed] = reader.dictionary[code]
    if (!decompressed) {
      // Non-terminal: recursively decompress and cache
      result = huffUnpackData(reader, result, depth + 1)
      reader.dictionary[code] = [result, true]
    }
    for (let j = 0; j < result.length; j++) output.push(result[j])
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
    // Search entire file for HUFF and CDIC records
    // Note: HUFF/CDIC records may be in the resource section (after resourceStart),
    // but the actual Huffman-encoded text records are in the standard text range
    // (firstTextIdx..lastTextIdx), NOT in the resource section
    let huffRecord: Uint8Array | null = null
    const cdicRecords: Uint8Array[] = []
    for (let ri = 0; ri < numRecords; ri++) {
      const data = readRecord(ri)
      if (data.length < 4) continue
      const tag = getString(data.slice(0, 4))
      if (tag === 'HUFF') huffRecord = data; else if (tag === 'CDIC') cdicRecords.push(data)
    }
    if (!huffRecord) throw new Error('HUFF/CDIC: HUFF record not found')

    const reader: any = { dictionary: [] }
    huffcdicLoad(reader, huffRecord, cdicRecords)

    // Decode text records: strip trailing bytes first, then Huffman-decode
    for (let ri = firstTextIdx; ri < lastTextIdx; ri++) {
      let data = readRecord(ri)
      // Strip trailing data (Koodo does this)
      for (let k = 0; k < numTrailing; k++) {
        const l = getVarLenFromEnd(data)
        if (l > 0 && l <= data.length) data = data.slice(0, -l)
      }
      if (multibyte && data.length > 0) {
        const m = (data[data.length - 1] & 3) + 1
        if (m > 0 && m < data.length) data = data.slice(0, -m)
      }
      if (data.length === 0) continue
      const decoded = huffUnpackData(reader, data)
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
  } else if (compression === 1) {
    // No compression (MOBI v7)
    for (let ri = firstTextIdx; ri < lastTextIdx; ri++) {
      const data = readRecord(ri)
      for (let j = 0; j < data.length; j++) allOutput.push(data[j])
    }
  } else if (compression !== 17480) {
    // Fallback: try reading as raw text (no decompression)
    for (let ri = firstTextIdx; ri < lastTextIdx; ri++) {
      const data = readRecord(ri)
      for (let j = 0; j < data.length; j++) allOutput.push(data[j])
    }
  }

  let html = decode.decode(new Uint8Array(allOutput))

  // ── Image extraction: convert <img recindex> to base64 data URLs ─────
  // Only match recindex inside <img ... > tags to avoid false positives
  const resourceStart = (mobi.resourceStart as number) ?? 0xFFFFFFFF
  const rs = (resourceStart > 0 && resourceStart < numRecords && resourceStart !== 0xFFFFFFFF) ? resourceStart : 0
  const seenImages = new Map<string, string>()
  html = html.replace(/<img\s+[^>]*?recindex="(\d+)"([^>]*)>/gi, (fullMatch, numStr: string, rest: string) => {
    if (seenImages.has(numStr)) {
      return fullMatch.replace(/recindex="\d+"/i, seenImages.get(numStr)!)
    }
    const idx = parseInt(numStr, 10)
    let imgData: Uint8Array | null = null
    for (const candidate of [rs + idx, idx]) {
      try {
        const d = readRecord(candidate)
        if (d.length > 2 && ((d[0] === 0xFF && d[1] === 0xD8) || (d[0] === 0x89 && d[1] === 0x50) || (d[0] === 0x47 && d[1] === 0x49))) {
          imgData = d; break
        }
      } catch (_) {}
    }
    if (!imgData) return fullMatch.replace(/recindex="\d+"/i, '')
    let mime = 'image/jpeg'
    if (imgData[0] === 0x89 && imgData[1] === 0x50) mime = 'image/png'
    else if (imgData[0] === 0x47 && imgData[1] === 0x49) mime = 'image/gif'
    else if (imgData[0] === 0x42 && imgData[1] === 0x4D) mime = 'image/bmp'
    let binary = ''
    for (let bi = 0; bi < imgData.length; bi++) binary += String.fromCharCode(imgData[bi])
    const result = `src="data:${mime};base64,${btoa(binary)}"`
    seenImages.set(numStr, result)
    // Reconstruct <img> tag with src attribute
    const cleaned = rest.replace(/recindex="\d+"/i, '').replace(/\s{2,}/g, ' ')
    return `<img ${result}${cleaned}>`
  })

  // ── KF8/AZW3 image extraction: convert kindle:embed:XXXX to base64 ──
  // kindle:embed:0001 = first image after resourceStart (1-based)
  html = html.replace(/src="kindle:embed:(\d+)(\?[^"]*)?"/gi, (_match, numStr: string) => {
    const idx = parseInt(numStr, 10)
    if (seenImages.has(`embed:${numStr}`)) return seenImages.get(`embed:${numStr}`)!
    const recIdx = rs + idx
    try {
      const imgData = readRecord(recIdx)
      if (imgData.length > 2 && ((imgData[0] === 0xFF && imgData[1] === 0xD8) || (imgData[0] === 0x89 && imgData[1] === 0x50))) {
        let mime = imgData[0] === 0x89 ? 'image/png' : 'image/jpeg'
        let binary = ''
        for (let bi = 0; bi < imgData.length; bi++) binary += String.fromCharCode(imgData[bi])
        const result = `src="data:${mime};base64,${btoa(binary)}"`
        seenImages.set(`embed:${numStr}`, result)
        return result
      }
    } catch (_) {}
    return _match
  })

  // Strip KF8 flow document wrappers: XML declarations, DOCTYPE, html/head/body tags
  // KF8 content is multi-document; we want to keep all body content
  html = html
    .replace(/<\?xml[^?]*\?>/gi, '')               // XML declarations (may be garbled)
    .replace(/<!DOCTYPE[^>]*>/gi, '')               // DOCTYPE
    .replace(/<\/?html[^>]*>/gi, '')                // <html> / </html>
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')  // <head>...</head>
    .replace(/<\/?body[^>]*>/gi, '')                // <body> / </body>

  // Strip garbled KF8 flow document wrappers that survive XML/HTML tag cleanup
  // These appear between flow docs as garbled <?xml>/<!DOCTYPE>/<html> tags
  html = html
    .replace(/<[^>]{0,200}?(?:html PUBLIC|DTD \w|xmlns=|www\.w3|DOCTYPE html|standal)[^>]{0,400}?>/gi, '')
    // Strip leading garbage before the first real HTML tag
    .replace(/^[\s\S]{0,200}?(?=<(?:h[1-6]|div|p[\s>]|a[\s>]))/i, '')

  // ── Chapter detection: support multiple heading formats ──────────
  // Must run BEFORE font size stripping (which removes the size attr we match on)
  const chapters: MobiChapter[] = []
  const headingMatches: { pos: number; heading: string }[] = []

  // Pattern 1: Standard <h1> through <h3> tags
  const hPattern = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi
  let m: RegExpExecArray | null
  while ((m = hPattern.exec(html)) !== null) {
    const h = m[1].replace(/<[^>]+>/g, '').trim()
    if (h && h.length < 200) headingMatches.push({ pos: m.index, heading: h })
  }

  // Pattern 2: <font size="7"><b>Title</b></font> (common MOBI chapter headings)
  if (headingMatches.length === 0) {
    const fontH = /<font\s+size="7"\s*>\s*<b>([^<]+)<\/b>\s*<\/font>/gi
    while ((m = fontH.exec(html)) !== null) {
      const h = m[1].trim()
      if (h && h.length >= 4 && h.length < 200 && !/^图\d/.test(h) && !/^\d+$/.test(h)
          && !/table of contents/i.test(h) && !/^contents$/i.test(h))
        headingMatches.push({ pos: m.index, heading: h })
    }
  }

  // Pattern 3: <font size="6"><b>Title</b></font> (sub-headings)
  if (headingMatches.length === 0) {
    const fontH2 = /<font\s+size="[56]"\s*>\s*<b>([^<]+)<\/b>\s*<\/font>/gi
    while ((m = fontH2.exec(html)) !== null) {
      const h = m[1].trim()
      if (h && h.length >= 4 && h.length < 200 && !/^图\d/.test(h) && !/^\d+$/.test(h)
          && !/table of contents/i.test(h) && !/^contents$/i.test(h))
        headingMatches.push({ pos: m.index, heading: h })
    }
  }
  // Pattern 4 (fallback): chapter titles from <a filepos=XXXXX>Title</a>
  // Use filepos value as split position (points to actual content, not TOC location)
  if (headingMatches.length === 0) {
    const aPattern = /<a\s+filepos=(\d+)>([^<]{2,80})<\/a>/gi
    const seen = new Set<string>()
    while ((m = aPattern.exec(html)) !== null) {
      const filepos = parseInt(m[1], 10)
      const h = m[2].trim()
      if (h && h.length >= 4 && !seen.has(h) && !/^[0-9\s]+$/.test(h)
          && !/table of contents/i.test(h) && !/^contents$/i.test(h)
          && !/titlepage/i.test(h) && !/start/i.test(h)) {
        seen.add(h)
        headingMatches.push({ pos: filepos, heading: h })
      }
    }
    // Sort by filepos (content position)
    headingMatches.sort((a, b) => a.pos - b.pos)
  }

  // Strip font size attributes from EVERY chapter's HTML so CSS scaling works
  const stripFontSize = (s: string) => s.replace(/<font[^>]*>/gi, (tag) => tag.replace(/\s*size\s*=\s*["'][^"']*["']/gi, '').replace(/\s*size\s*=\s*\d+/gi, ''))

  if (headingMatches.length > 0) {
    for (let i = 0; i < headingMatches.length; i++) {
      const start = headingMatches[i].pos, end = i + 1 < headingMatches.length ? headingMatches[i + 1].pos : html.length
      let chunk = html.slice(start, end).replace(/<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>/i, '')
      chapters.push({ title: headingMatches[i].heading, html: stripFontSize(chunk) })
    }
  } else {
    chapters.push({ title, html: stripFontSize(html) })
  }

  // Also strip from main html variable (for any remaining downstream use)
  html = stripFontSize(html)
  // Remove fixed width/height that interfere with layout
  html = html.replace(/\s+width\s*=\s*["']0pt["']/gi, '')
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<mbp:pagebreak[^>]*\/?>/gi, '').replace(/<a[^>]*filepos=\d+[^>]*>[\s\S]*?<\/a>/gi, '').replace(/<a[^>]*>\s*<\/a>/gi, '').replace(/�/g, '').trim()

  return { metadata: { title, author }, chapters }
}
