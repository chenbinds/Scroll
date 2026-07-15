/**
 * Resolve a stable userData directory and (once) migrate legacy stores.
 *
 * Problem: Scroll.vbs may launch packaged (exe-adjacent UserData) OR unpackaged
 * (AppData\scroll-ebook-reader). Each path has a separate bookshelf → books appear
 * to vanish and reappear.
 *
 * Rules:
 * - Inside this repo (dev out/ OR release/win-unpacked): always projectRoot/UserData/
 * - True portable folder (dist zip / copied elsewhere): UserData next to Scroll.exe
 */

import { app } from 'electron'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  copyFileSync,
  writeFileSync
} from 'fs'
import { join, dirname } from 'path'

const PKG_NAME = 'scroll-ebook-reader'

function tryReadPkgName(dir: string): string | null {
  const pkgPath = join(dir, 'package.json')
  if (!existsSync(pkgPath)) return null
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { name?: string }
    return pkg.name || null
  } catch {
    return null
  }
}

function findProjectRootFrom(start: string): string | null {
  let dir = start
  for (let i = 0; i < 6; i++) {
    if (tryReadPkgName(dir) === PKG_NAME) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

function resolveUserDataDir(): { dir: string; projectRoot: string | null } {
  if (!app.isPackaged) {
    // electron + out/main/index.js → __dirname = <root>/out/main
    const projectRoot = findProjectRootFrom(join(__dirname, '../..'))
    if (projectRoot) {
      return { dir: join(projectRoot, 'UserData'), projectRoot }
    }
    return { dir: app.getPath('userData'), projectRoot: null }
  }

  const appDir = dirname(process.execPath)
  // release/win-unpacked → project root two levels up
  const projectRoot = findProjectRootFrom(join(appDir, '../..'))
  if (projectRoot) {
    return { dir: join(projectRoot, 'UserData'), projectRoot }
  }
  // True portable distribution folder
  return { dir: join(appDir, 'UserData'), projectRoot: null }
}

function booksCount(userDataDir: string): number {
  const f = join(userDataDir, 'data', 'books_books.json')
  if (!existsSync(f)) return 0
  try {
    const books = JSON.parse(readFileSync(f, 'utf-8')) as unknown
    return Array.isArray(books) ? books.length : 0
  } catch {
    return 0
  }
}

function listJsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((n) => n.endsWith('.json'))
}

function copyDirFiles(srcDir: string, dstDir: string): void {
  if (!existsSync(srcDir)) return
  if (!existsSync(dstDir)) mkdirSync(dstDir, { recursive: true })
  for (const name of readdirSync(srcDir)) {
    const src = join(srcDir, name)
    const dst = join(dstDir, name)
    try {
      if (statSync(src).isFile()) copyFileSync(src, dst)
    } catch {
      /* skip locked / unreadable */
    }
  }
}

type BookRow = { id?: string; path?: string; title?: string; [k: string]: unknown }

function readBooks(userDataDir: string): BookRow[] {
  const f = join(userDataDir, 'data', 'books_books.json')
  if (!existsSync(f)) return []
  try {
    const books = JSON.parse(readFileSync(f, 'utf-8')) as unknown
    return Array.isArray(books) ? (books as BookRow[]) : []
  } catch {
    return []
  }
}

function bookKey(book: BookRow): string {
  if (book.path) {
    return 'p:' + String(book.path).replace(/\\/g, '/').toLowerCase()
  }
  if (book.id) return 'i:' + String(book.id)
  return 't:' + String(book.title || '').trim().toLowerCase() + '|' + String(book.format || '').toLowerCase()
}

function softTitleKey(book: BookRow): string {
  return String(book.title || '').trim().toLowerCase() + '|' + String(book.format || '').toUpperCase()
}

function mergeBooks(stores: string[]): BookRow[] {
  const byKey = new Map<string, BookRow>()
  const byTitle = new Map<string, string>() // softTitle → primary key

  for (const store of stores) {
    for (const book of readBooks(store)) {
      const key = bookKey(book)
      const titleKey = softTitleKey(book)

      // Same title+format already merged under another id/path → skip duplicate
      const existingTitleKey = byTitle.get(titleKey)
      if (existingTitleKey && existingTitleKey !== key && byKey.has(existingTitleKey)) {
        const prev = byKey.get(existingTitleKey)!
        const prevCover = typeof prev.coverUrl === 'string' && prev.coverUrl.length > 0
        const nextCover = typeof book.coverUrl === 'string' && book.coverUrl.length > 0
        if (!prevCover && nextCover) byKey.set(existingTitleKey, { ...prev, coverUrl: book.coverUrl })
        continue
      }

      const prev = byKey.get(key)
      if (!prev) {
        byKey.set(key, book)
        if (titleKey !== '|') byTitle.set(titleKey, key)
        continue
      }
      const prevCover = typeof prev.coverUrl === 'string' && prev.coverUrl.length > 0
      const nextCover = typeof book.coverUrl === 'string' && book.coverUrl.length > 0
      if (!prevCover && nextCover) byKey.set(key, book)
    }
  }
  return Array.from(byKey.values())
}

function legacyUserDataDirs(projectRoot: string | null): string[] {
  const dirs: string[] = []
  // Electron default (unpackaged before this fix)
  const roaming = process.env.APPDATA
  if (roaming) {
    dirs.push(join(roaming, 'scroll-ebook-reader'))
  }
  if (projectRoot) {
    dirs.push(join(projectRoot, 'release', 'win-unpacked', 'UserData'))
    const distRoot = join(projectRoot, 'dist')
    if (existsSync(distRoot)) {
      try {
        for (const name of readdirSync(distRoot)) {
          const ud = join(distRoot, name, 'UserData')
          if (existsSync(join(ud, 'data'))) dirs.push(ud)
        }
      } catch {
        /* ignore */
      }
    }
  }
  return dirs.filter((d) => existsSync(d))
}

/**
 * If project UserData has no bookshelf yet, merge books/covers/settings from
 * AppData + old exe-adjacent UserData folders (pick all unique books).
 */
function migrateLegacyIfNeeded(targetDir: string, projectRoot: string | null): void {
  const marker = join(targetDir, '.scroll-migrated-v2')
  const oldMarker = join(targetDir, '.scroll-migrated-v1')
  if (existsSync(marker)) return
  if (existsSync(oldMarker)) {
    try {
      /* allow re-merge with better dedupe */
    } catch {
      /* ignore */
    }
  }

  const legacy = legacyUserDataDirs(projectRoot).filter((d) => d !== targetDir)
  if (legacy.length === 0) {
    writeFileSync(marker, new Date().toISOString(), 'utf-8')
    return
  }

  const targetCount = booksCount(targetDir)
  const richestLegacy = Math.max(0, ...legacy.map(booksCount))

  // Migrate when empty, or when v1 left duplicate-heavy shelf (re-merge once)
  const needsMerge =
    targetCount === 0 ||
    (richestLegacy > 0 && targetCount < richestLegacy) ||
    existsSync(oldMarker)

  if (!needsMerge) {
    writeFileSync(marker, new Date().toISOString(), 'utf-8')
    return
  }

  const dataDir = join(targetDir, 'data')
  const coversDir = join(targetDir, 'covers')
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
  if (!existsSync(coversDir)) mkdirSync(coversDir, { recursive: true })

  // Copy settings / music / annotations from the legacy store with most books first,
  // then fill gaps from others (do not overwrite newer target files)
  const ordered = [...legacy].sort((a, b) => booksCount(b) - booksCount(a))
  for (const store of ordered) {
    const srcData = join(store, 'data')
    for (const name of listJsonFiles(srcData)) {
      if (name === 'books_books.json') continue
      const dst = join(dataDir, name)
      if (existsSync(dst)) continue
      try {
        copyFileSync(join(srcData, name), dst)
      } catch {
        /* skip */
      }
    }
    copyDirFiles(join(store, 'covers'), coversDir)
  }

  const merged = mergeBooks([targetDir, ...ordered])
  writeFileSync(join(dataDir, 'books_books.json'), JSON.stringify(merged), 'utf-8')

  writeFileSync(
    marker,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        from: ordered,
        books: merged.length
      },
      null,
      2
    ),
    'utf-8'
  )
  if (existsSync(oldMarker)) {
    try {
      writeFileSync(oldMarker + '.done', 'v2', 'utf-8')
    } catch {
      /* ignore */
    }
  }
  console.log(
    `[scroll] migrated bookshelf → ${targetDir} (${merged.length} books from ${ordered.length} legacy store(s))`
  )
}

function configurePortableUserData(): void {
  const { dir, projectRoot } = resolveUserDataDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  app.setPath('userData', dir)
  try {
    migrateLegacyIfNeeded(dir, projectRoot)
  } catch (err) {
    console.error('[scroll] UserData migration failed:', err)
  }
  console.log(`[scroll] userData = ${dir}`)
}

configurePortableUserData()
