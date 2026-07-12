/**
 * Comic book parser — CBZ (ZIP) / CBR (RAR).
 *
 * CBZ: ZIP archive containing images. Extracted with JSZip.
 * CBR: RAR archive containing images. Basic RAR 4.x reader supporting stored (0x30) files.
 *
 * Most CBR files store JPEG/PNG uncompressed since they're already compressed.
 */

import JSZip from 'jszip'

export interface ComicPage {
  name: string
  dataUrl: string
}

// ── CBZ (ZIP) ─────────────────────────────────────────────────────

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tif', 'tiff'])

function extByMime(mime: string): string {
  const m = mime.match(/image\/(\w+)/)
  return m ? m[1] : 'jpeg'
}

async function parseCbz(base64Data: string): Promise<ComicPage[]> {
  const binaryStr = atob(base64Data)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)

  const zip = await JSZip.loadAsync(bytes)

  const pages: ComicPage[] = []
  const promises: Promise<void>[] = []

  zip.forEach((relativePath, file) => {
    if (file.dir) return
    const ext = relativePath.split('.').pop()?.toLowerCase() || ''
    if (!IMAGE_EXTS.has(ext)) return

    promises.push(
      file.async('base64').then((b64) => {
        const mime = ext === 'jpg' ? 'jpeg' : ext
        pages.push({
          name: relativePath,
          dataUrl: `data:image/${mime};base64,${b64}`
        })
      })
    )
  })

  await Promise.all(promises)

  // Sort by filename (natural sort)
  pages.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

  return pages
}

// ── CBR (RAR) — Basic RAR 4.x Reader ──────────────────────────────

const RAR_MARKER = 0x72  // 0x72 = main archive header
const RAR_FILE_HEAD = 0x74  // file header
const RAR_END_HEAD = 0x7B  // end of archive

function readRarU16(view: DataView, off: number): number {
  return view.getUint16(off, true) // RAR is little-endian
}

function readRarU32(view: DataView, off: number): number {
  return view.getUint32(off, true)
}

async function parseCbr(base64Data: string): Promise<ComicPage[]> {
  const binaryStr = atob(base64Data)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  // Check RAR signature: 0x52 0x61 0x72 0x21 0x1A 0x07 0x00
  if (bytes[0] !== 0x52 || bytes[1] !== 0x61 || bytes[2] !== 0x72 || bytes[3] !== 0x21) {
    throw new Error('Not a valid RAR file')
  }

  const pages: ComicPage[] = []
  let offset = 7 // skip marker header

  while (offset < bytes.length - 11) {
    const headCrc = readRarU16(view, offset)
    const headType = view.getUint8(offset + 2)
    const headFlags = readRarU16(view, offset + 3)
    const headSize = readRarU16(view, offset + 5)

    if (headType === RAR_END_HEAD) break
    if (headSize < 7) break

    if (headType === RAR_FILE_HEAD) {
      // File header layout (RAR 4.x):
      // +0:  PACK_SIZE (4) — file size in archive
      // +4:  UNP_SIZE (4) — file size uncompressed
      // +8:  HOST_OS (1)
      // +9:  FILE_CRC (4)
      // +13: FTIME (4) — DOS date/time
      // +17: UNP_VER (1)
      // +18: METHOD (1) — 0x30 = stored
      // +19: NAME_SIZE (2)
      // +21: ATTR (4)
      const fileDataStart = offset + 7 // after header base
      const packSize = readRarU32(view, fileDataStart)
      const unpSize = readRarU32(view, fileDataStart + 4)
      const method = view.getUint8(fileDataStart + 18)
      const nameSize = readRarU16(view, fileDataStart + 19)

      const nameStart = fileDataStart + 25
      // Filename as UTF-8 (in RAR 4.x it's generally ASCII/UTF-8)
      const nameBytes = bytes.slice(nameStart, nameStart + nameSize)
      const fileName = new TextDecoder('utf-8').decode(nameBytes)

      const dataOffset = offset + headSize
      const dataEnd = dataOffset + packSize

      // Check if image file
      const ext = fileName.split('.').pop()?.toLowerCase() || ''
      if (IMAGE_EXTS.has(ext)) {
        if (method === 0x30) {
          // Stored (uncompressed) — most CBR files
          const mime = ext === 'jpg' ? 'jpeg' : ext
          const imgData = bytes.slice(dataOffset, dataEnd)
          const b64 = btoa(String.fromCharCode(...imgData))
          pages.push({
            name: fileName,
            dataUrl: `data:image/${mime};base64,${b64}`
          })
        }
        // Non-stored RAR files: skip (compression not supported without unrar library)
      }

      offset = dataEnd
    } else {
      // Skip unknown block type
      offset += headSize
    }
  }

  if (pages.length === 0) {
    throw new Error('No images found in CBR archive')
  }

  pages.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  return pages
}

// ── Unified Parser ─────────────────────────────────────────────────

export async function parseComic(base64Data: string, format: 'CBZ' | 'CBR'): Promise<ComicPage[]> {
  // Try ZIP first (some CBR files are actually ZIP)
  if (format === 'CBR') {
    try {
      return await parseCbz(base64Data)
    } catch {
      // Not a ZIP, try RAR
    }
    try {
      return await parseCbr(base64Data)
    } catch (e) {
      throw new Error(`CBR format not supported: the RAR archive may use compression. ` +
        `Try converting to CBZ (ZIP) format. Error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  try {
    return await parseCbz(base64Data)
  } catch (e) {
    // CBZ should be ZIP, but try RAR as fallback
    try {
      return await parseCbr(base64Data)
    } catch {
      throw e
    }
  }
}
