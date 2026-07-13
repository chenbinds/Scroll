/** Resize data-URL covers so library JSON stays small. */

const MAX_EDGE = 320
const JPEG_QUALITY = 0.72
/** Above this, treat as needing compression (~40KB). */
const COMPRESS_THRESHOLD = 40_000

export async function compressCoverDataUrl(
  dataUrl: string,
  maxEdge = MAX_EDGE,
  quality = JPEG_QUALITY
): Promise<string> {
  if (!dataUrl?.startsWith('data:image/')) return dataUrl
  if (dataUrl.length < COMPRESS_THRESHOLD) return dataUrl

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(dataUrl); return }
        ctx.drawImage(img, 0, 0, w, h)
        const out = canvas.toDataURL('image/jpeg', quality)
        resolve(out.length < dataUrl.length ? out : dataUrl)
      } catch {
        resolve(dataUrl)
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

/** Shrink oversized covers already stored in the library. */
export async function slimBookCovers<T extends { coverUrl?: string }>(
  books: T[]
): Promise<{ books: T[]; changed: boolean }> {
  let changed = false
  const next = await Promise.all(
    books.map(async (b) => {
      if (!b.coverUrl || b.coverUrl.length < COMPRESS_THRESHOLD) return b
      const slim = await compressCoverDataUrl(b.coverUrl)
      if (slim !== b.coverUrl) {
        changed = true
        return { ...b, coverUrl: slim }
      }
      return b
    })
  )
  return { books: next, changed }
}
