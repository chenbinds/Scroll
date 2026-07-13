/**
 * Cover images live on disk under userData/covers/{bookId}.jpg
 * Book.coverUrl uses scroll-cover://local/{bookId}
 */

import { app, nativeImage, protocol, net } from 'electron'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { pathToFileURL } from 'url'

const COVER_SCHEME = 'scroll-cover'

let coversDirCached: string | null = null

export function getCoversDir(): string {
  if (coversDirCached) return coversDirCached
  const dir = join(app.getPath('userData'), 'covers')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  coversDirCached = dir
  return dir
}

export function coverFilePath(bookId: string): string {
  return join(getCoversDir(), `${bookId}.jpg`)
}

export function coverUrlFor(bookId: string): string {
  return `${COVER_SCHEME}://local/${bookId}`
}

export function isCoverRef(url?: string): boolean {
  return !!url && url.startsWith(`${COVER_SCHEME}://`)
}

export function bookIdFromCoverUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const id = u.pathname.replace(/^\//, '')
    return id || null
  } catch {
    return null
  }
}

/** Compress and write a data-URL / buffer cover to disk. Returns scroll-cover:// URL. */
export function saveCoverFromDataUrl(bookId: string, dataUrl: string): string | null {
  try {
    const m = dataUrl.match(/^data:([^;,]+);base64,(.+)$/i)
    if (!m) return null
    const raw = Buffer.from(m[2], 'base64')
    let img = nativeImage.createFromBuffer(raw)

    if (!img.isEmpty()) {
      const { width, height } = img.getSize()
      const maxEdge = 320
      if (width > maxEdge || height > maxEdge) {
        const scale = maxEdge / Math.max(width, height)
        img = img.resize({
          width: Math.max(1, Math.round(width * scale)),
          height: Math.max(1, Math.round(height * scale)),
          quality: 'better'
        })
      }
      writeFileSync(coverFilePath(bookId), img.toJPEG(72))
    } else {
      writeFileSync(coverFilePath(bookId), raw)
    }
    return coverUrlFor(bookId)
  } catch (e) {
    console.error('saveCoverFromDataUrl failed', bookId, e)
    return null
  }
}

/** Move inline data-URL covers out of the books array into files. */
export function migrateInlineCovers<T extends { id: string; coverUrl?: string }>(
  books: T[]
): { books: T[]; changed: boolean } {
  let changed = false
  const next = books.map((b) => {
    if (!b.coverUrl?.startsWith('data:')) return b
    const ref = saveCoverFromDataUrl(b.id, b.coverUrl)
    if (!ref) return b
    changed = true
    return { ...b, coverUrl: ref }
  })
  return { books: next, changed }
}

/** Must be called before app.whenReady() */
export function registerCoverSchemePrivileged(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: COVER_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        bypassCSP: true,
        stream: true,
        corsEnabled: true
      }
    }
  ])
}

/** Stream covers from disk (no full-buffer copy). */
export function registerCoverProtocol(): void {
  protocol.handle(COVER_SCHEME, (request) => {
    try {
      const id = bookIdFromCoverUrl(request.url)
      if (!id) return new Response('missing id', { status: 400 })
      const file = coverFilePath(id)
      if (!existsSync(file)) return new Response('not found', { status: 404 })
      return net.fetch(pathToFileURL(file).href)
    } catch {
      return new Response('error', { status: 500 })
    }
  })
}
