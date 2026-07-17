/**
 * Library book files live under userData/books/{bookId}.{ext}
 * so the shelf survives moving/deleting the original Downloads copy.
 */

import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { basename, extname, join } from 'path'

let booksDirCached: string | null = null

export function getBooksDir(): string {
  if (booksDirCached) return booksDirCached
  const dir = join(app.getPath('userData'), 'books')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  booksDirCached = dir
  return dir
}

function safeExt(sourcePath: string): string {
  const ext = extname(sourcePath).toLowerCase()
  if (!ext || ext.length > 10) return '.bin'
  return ext
}

export function libraryBookPath(bookId: string, sourcePathOrExt: string): string {
  const ext = sourcePathOrExt.startsWith('.')
    ? sourcePathOrExt.toLowerCase()
    : safeExt(sourcePathOrExt)
  // Sanitize bookId for filesystem
  const id = bookId.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 120)
  return join(getBooksDir(), `${id}${ext}`)
}

export function isLibraryBookPath(filePath: string): boolean {
  const dir = getBooksDir().replace(/\\/g, '/').toLowerCase()
  const p = filePath.replace(/\\/g, '/').toLowerCase()
  return p === dir || p.startsWith(dir + '/')
}

/**
 * Copy a user-selected file into UserData/books/.
 * Returns the stable library path.
 */
export function importBookFile(
  sourcePath: string,
  bookId: string
): { ok: true; path: string } | { ok: false; error: 'missing' | 'copy_failed' } {
  if (!sourcePath || !existsSync(sourcePath)) {
    return { ok: false, error: 'missing' }
  }
  try {
    getBooksDir()
    const dest = libraryBookPath(bookId, sourcePath)
    copyFileSync(sourcePath, dest)
    return { ok: true, path: dest }
  } catch (err) {
    console.error('[scroll] importBookFile failed', err)
    return { ok: false, error: 'copy_failed' }
  }
}

/** Replace library file when user relocates a missing book. */
export function relocateBookFile(
  sourcePath: string,
  bookId: string,
  previousPath?: string
): { ok: true; path: string } | { ok: false; error: 'missing' | 'copy_failed' } {
  const result = importBookFile(sourcePath, bookId)
  if (!result.ok) return result
  // Remove old library copy if different path
  if (previousPath && previousPath !== result.path && isLibraryBookPath(previousPath)) {
    try {
      if (existsSync(previousPath)) unlinkSync(previousPath)
    } catch {
      /* ignore */
    }
  }
  return result
}

export function deleteLibraryBookFile(filePath: string): void {
  if (!filePath || !isLibraryBookPath(filePath)) return
  try {
    if (existsSync(filePath)) unlinkSync(filePath)
  } catch (err) {
    console.error('[scroll] deleteLibraryBookFile', err)
  }
}

export function displayNameFromPath(filePath: string): string {
  return basename(filePath)
}
