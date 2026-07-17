import { useCallback, useMemo, useState } from 'react'
import { Book as BookIcon, Plus, FolderOpen, ExternalLink } from 'lucide-react'

const ZLIBRARY_URL = 'https://zlib.ch'
import { useAppStore, type Book } from '../../stores/appStore'
import { useI18n } from '../../lib/i18n'
import { cleanBookTitle } from '../../lib/bookTitle'
import { compressCoverDataUrl } from '../../lib/coverImage'
import BookCard from './BookCard'

function patchBook(id: string, patch: Partial<Book>) {
  useAppStore.getState().setBooks(
    useAppStore.getState().books.map((b) => (b.id === id ? { ...b, ...patch } : b))
  )
}

type RatingError = 'network' | 'timeout' | 'blocked' | 'not_found' | 'http'

async function fetchDoubanRating(
  book: Pick<Book, 'id' | 'title' | 'author'>,
  unknownAuthorLabel: string
): Promise<{ rating: number } | { error: RatingError }> {
  const q =
    book.title.length > 3
      ? book.title
      : book.title + ' ' + (book.author !== unknownAuthorLabel && book.author !== 'Unknown Author' ? book.author : '')
  const info = await window.scrollAPI.doubanSearch(q)
  if (info?.ok) {
    patchBook(book.id, { doubanRating: info.rating })
    return { rating: info.rating }
  }
  return { error: info?.error ?? 'network' }
}

/** Ensure book file lives under UserData/books/ (copy if still on Downloads etc.). */
async function ensureLibraryCopy(book: Book): Promise<Book> {
  const inLib = await window.scrollAPI.isLibraryBookPath(book.path)
  if (inLib) return book
  const copied = await window.scrollAPI.importBookCopy({
    sourcePath: book.path,
    bookId: book.id
  })
  if (!copied.ok) return book
  patchBook(book.id, { path: copied.path })
  return { ...book, path: copied.path }
}

interface Props {
  libraryReady: boolean
}

export default function LibraryView({ libraryReady }: Props) {
  const { t } = useI18n()
  const { books, addBook, openBook, removeBook } = useAppStore()
  const [missingBook, setMissingBook] = useState<Book | null>(null)

  const sortedBooks = useMemo(
    () =>
      [...books].sort(
        (a, b) => (b.lastReadAt ?? b.addedAt ?? 0) - (a.lastReadAt ?? a.addedAt ?? 0)
      ),
    [books]
  )

  const handleImport = useCallback(async () => {
    if (!window.scrollAPI) {
      alert(t('error.preloadNotLoaded'))
      return
    }
    const paths = await window.scrollAPI.openBookDialog()
    if (!paths || paths.length === 0) return

    for (const sourcePath of paths) {
      const fileName = sourcePath.split(/[\\/]/).pop() || 'Unknown'
      const nameWithoutExt = fileName.replace(/\.[^.]+$/, '')
      const ext = fileName.split('.').pop()?.toLowerCase() || ''
      const bookId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

      const copied = await window.scrollAPI.importBookCopy({
        sourcePath,
        bookId
      })
      if (!copied.ok) {
        alert(t('library.importCopyFailed'))
        continue
      }

      const book: Book = {
        id: bookId,
        title: cleanBookTitle(nameWithoutExt),
        author: t('library.unknownAuthor'),
        format: ext.toUpperCase(),
        path: copied.path,
        addedAt: Date.now(),
        lastReadAt: Date.now(),
        progress: 0,
        totalPages: 0,
        currentPage: 0
      }

      addBook(book)

      fetchDoubanRating(book, t('library.unknownAuthor')).catch(() => {})

      const fmt = ext.toUpperCase()
      if (fmt === 'EPUB') {
        window.scrollAPI.readPath(copied.path).then(async (base64: string | null) => {
          if (!base64) return
          try {
            const { extractEpubCover } = await import('../../lib/epubParser')
            const coverUrl = await extractEpubCover(base64)
            if (coverUrl) {
              const compressed = await compressCoverDataUrl(coverUrl)
              const ref = await window.scrollAPI.saveCover(book.id, compressed)
              patchBook(book.id, { coverUrl: ref || compressed })
            }
          } catch { /* ignore */ }
        }).catch(() => {})
      } else if (fmt === 'MOBI' || fmt === 'AZW' || fmt === 'AZW3') {
        window.scrollAPI.readPath(copied.path).then(async (base64: string | null) => {
          if (!base64) return
          try {
            const { extractMobiCover } = await import('../../lib/mobiParser')
            const coverUrl = await extractMobiCover(base64)
            if (coverUrl) {
              const ref = await window.scrollAPI.saveCover(book.id, coverUrl)
              patchBook(book.id, { coverUrl: ref || coverUrl })
            }
          } catch { /* ignore */ }
        }).catch(() => {})
      }
    }
  }, [addBook, t])

  const handleOpen = useCallback(async (book: Book) => {
    const exists = await window.scrollAPI.pathExists(book.path)
    if (!exists) {
      setMissingBook(book)
      return
    }
    const stable = await ensureLibraryCopy(book)
    openBook(stable)
  }, [openBook])

  const handleDelete = useCallback(async (book: Book) => {
    await window.scrollAPI.deleteBookFile(book.path)
    removeBook(book.id)
  }, [removeBook])

  const handleRelocate = useCallback(async () => {
    if (!missingBook) return
    const paths = await window.scrollAPI.openBookDialog()
    if (!paths || paths.length === 0) return
    const sourcePath = paths[0]
    const result = await window.scrollAPI.relocateBook({
      sourcePath,
      bookId: missingBook.id,
      previousPath: missingBook.path
    })
    if (!result.ok) {
      alert(t('library.relocateFailed'))
      return
    }
    const updated = { ...missingBook, path: result.path }
    patchBook(missingBook.id, { path: result.path })
    setMissingBook(null)
    openBook(updated)
  }, [missingBook, openBook, t])

  const handleRemoveMissing = useCallback(async () => {
    if (!missingBook) return
    await window.scrollAPI.deleteBookFile(missingBook.path)
    removeBook(missingBook.id)
    setMissingBook(null)
  }, [missingBook, removeBook])

  const handleOpenZLibrary = useCallback(() => {
    void window.scrollAPI.openExternal(ZLIBRARY_URL)
  }, [])

  const handleRefreshRating = useCallback(async (book: Book) => {
    return fetchDoubanRating(book, t('library.unknownAuthor'))
  }, [t])

  const handleSetManualRating = useCallback((bookId: string, rating: number | null) => {
    patchBook(bookId, rating != null ? { doubanRating: rating } : { doubanRating: undefined })
  }, [])

  const handleRefreshCover = useCallback(async (book: Book) => {
    const exists = await window.scrollAPI.pathExists(book.path)
    if (!exists) {
      setMissingBook(book)
      throw new Error('missing')
    }
    const base64 = await window.scrollAPI.readPath(book.path)
    if (!base64) throw new Error('read failed')
    const fmt = book.format.toUpperCase()
    let coverUrl: string | null = null
    if (fmt === 'EPUB') {
      const { extractEpubCover } = await import('../../lib/epubParser')
      const raw = await extractEpubCover(base64)
      if (raw) coverUrl = await compressCoverDataUrl(raw)
    } else if (fmt === 'MOBI' || fmt === 'AZW' || fmt === 'AZW3') {
      const { extractMobiCover } = await import('../../lib/mobiParser')
      coverUrl = await extractMobiCover(base64)
    } else if (fmt === 'CBZ' || fmt === 'CBR') {
      const { parseComic } = await import('../../lib/comicParser')
      const pages = await parseComic(base64, fmt as 'CBZ' | 'CBR')
      if (pages[0]?.dataUrl) coverUrl = pages[0].dataUrl
    }
    if (!coverUrl) throw new Error('no cover')
    const ref = await window.scrollAPI.saveCover(book.id, coverUrl)
    patchBook(book.id, { coverUrl: ref || coverUrl })
  }, [])

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      {!libraryReady && (
        <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-600">
          <div className="flex gap-1.5 mb-4">
            <span className="w-2.5 h-2.5 bg-scroll-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2.5 h-2.5 bg-scroll-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2.5 h-2.5 bg-scroll-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('library.loading')}</p>
        </div>
      )}

      {libraryReady && books.length === 0 && (
        <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-600">
          <BookIcon size={64} strokeWidth={1} />
          <h2 className="mt-4 text-lg font-medium text-gray-500 dark:text-gray-400">
            {t('library.empty.title')}
          </h2>
          <p className="mt-1 text-sm">{t('library.empty.subtitle')}</p>
          <button
            onClick={handleImport}
            className="mt-6 px-6 py-3 bg-scroll-500 hover:bg-scroll-600 text-white rounded-lg
                       flex items-center gap-2 transition-colors shadow-lg shadow-scroll-500/25"
          >
            <Plus size={20} />
            {t('library.empty.importBtn')}
          </button>
        </div>
      )}

      {libraryReady && books.length > 0 && (
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('library.title')} ({sortedBooks.length})
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handleImport}
                className="px-4 py-2 bg-scroll-500 hover:bg-scroll-600 text-white text-sm
                           rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <FolderOpen size={16} />
                {t('library.import')}
              </button>
              <button
                onClick={handleOpenZLibrary}
                className="px-4 py-2 text-sm rounded-lg flex items-center gap-1.5 transition-colors
                           border border-gray-300 dark:border-gray-600
                           text-gray-700 dark:text-gray-300
                           hover:bg-gray-100 dark:hover:bg-gray-800"
                title={ZLIBRARY_URL}
              >
                <ExternalLink size={16} />
                {t('library.zlibrary')}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3 [content-visibility:auto]">
            {sortedBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onClick={() => { void handleOpen(book) }}
                onDelete={() => { void handleDelete(book) }}
                onRefreshRating={() => handleRefreshRating(book)}
                onSetManualRating={(rating) => handleSetManualRating(book.id, rating)}
                onRefreshCover={() => handleRefreshCover(book)}
              />
            ))}
          </div>
        </div>
      )}

      {missingBook && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setMissingBook(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {t('library.fileMissing.title')}
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {t('library.fileMissing.body')}
            </p>
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 break-all">
              {missingBook.title}
              <br />
              {missingBook.path}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setMissingBook(null)}
                className="px-3 py-1.5 text-sm rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                {t('library.fileMissing.cancel')}
              </button>
              <button
                type="button"
                onClick={() => { void handleRemoveMissing() }}
                className="px-3 py-1.5 text-sm rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
              >
                {t('library.fileMissing.remove')}
              </button>
              <button
                type="button"
                onClick={() => { void handleRelocate() }}
                className="px-3 py-1.5 text-sm rounded-lg bg-scroll-500 hover:bg-scroll-600 text-white"
              >
                {t('library.fileMissing.relocate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
