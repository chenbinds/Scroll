import { useCallback } from 'react'
import { Book as BookIcon, Plus, FolderOpen } from 'lucide-react'
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

interface Props {
  libraryReady: boolean
}

export default function LibraryView({ libraryReady }: Props) {
  const { t } = useI18n()
  const { books, addBook, openBook, removeBook } = useAppStore()

  const handleImport = useCallback(async () => {
    if (!window.scrollAPI) {
      alert(t('error.preloadNotLoaded'))
      return
    }
    const paths = await window.scrollAPI.openBookDialog()
    if (!paths || paths.length === 0) return

    for (const path of paths) {
      const fileName = path.split(/[\\/]/).pop() || 'Unknown'
      const nameWithoutExt = fileName.replace(/\.[^.]+$/, '')
      const ext = fileName.split('.').pop()?.toLowerCase() || ''

      const book: Book = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        title: cleanBookTitle(nameWithoutExt),
        author: t('library.unknownAuthor'),
        format: ext.toUpperCase(),
        path,
        addedAt: Date.now(),
        lastReadAt: Date.now(),
        progress: 0,
        totalPages: 0,
        currentPage: 0
      }

      addBook(book)

      // Douban: fetch once on import only
      fetchDoubanRating(book, t('library.unknownAuthor')).catch(() => {})

      const fmt = ext.toUpperCase()
      if (fmt === 'EPUB') {
        window.scrollAPI.readPath(path).then(async (base64: string | null) => {
          if (!base64) return
          try {
            const { extractEpubCover } = await import('../../lib/epubParser')
            const coverUrl = await extractEpubCover(base64)
            if (coverUrl) patchBook(book.id, { coverUrl: await compressCoverDataUrl(coverUrl) })
          } catch { /* ignore */ }
        }).catch(() => {})
      } else if (fmt === 'MOBI' || fmt === 'AZW' || fmt === 'AZW3') {
        window.scrollAPI.readPath(path).then(async (base64: string | null) => {
          if (!base64) return
          try {
            const { extractMobiCover } = await import('../../lib/mobiParser')
            const coverUrl = await extractMobiCover(base64)
            if (coverUrl) patchBook(book.id, { coverUrl })
          } catch { /* ignore */ }
        }).catch(() => {})
      }
    }
  }, [addBook, t])

  const handleRefreshRating = useCallback(async (book: Book) => {
    return fetchDoubanRating(book, t('library.unknownAuthor'))
  }, [t])

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
              {t('library.title')} ({books.length})
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
            </div>
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3 [content-visibility:auto]">
            {books.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onClick={() => openBook(book)}
                onDelete={() => removeBook(book.id)}
                onRefreshRating={() => handleRefreshRating(book)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
