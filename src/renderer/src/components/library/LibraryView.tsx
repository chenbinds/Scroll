import { useCallback } from 'react'
import { Book as BookIcon, Plus, FolderOpen } from 'lucide-react'
import { useAppStore, type Book } from '../../stores/appStore'
import { useI18n } from '../../lib/i18n'
import { extractEpubCover } from '../../lib/epubParser'
import BookCard from './BookCard'

export default function LibraryView() {
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
        title: nameWithoutExt,
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

      // Async: extract EPUB cover in background
      if (ext.toUpperCase() === 'EPUB') {
        window.scrollAPI.readFile(path).then((base64) => {
          extractEpubCover(base64).then((coverUrl) => {
            if (coverUrl) {
              useAppStore.getState().setBooks(
                useAppStore.getState().books.map((b) => b.id === book.id ? { ...b, coverUrl } : b)
              )
            }
          }).catch(() => {})
        }).catch(() => {})
      }
    }
  }, [addBook, t])

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      {books.length === 0 && (
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

      {books.length > 0 && (
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

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {books.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onClick={() => openBook(book)}
                onDelete={() => removeBook(book.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
