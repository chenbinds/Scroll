import { X, Star } from 'lucide-react'
import type { Book } from '../../stores/appStore'

const FORMAT_COLORS: Record<string, string> = {
  PDF: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  EPUB: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  MOBI: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  TXT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  MD: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  CBZ: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  DJVU: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
}

interface Props {
  book: Book
  onClick: () => void
  onDelete: () => void
}

export default function BookCard({ book, onClick, onDelete }: Props) {
  const formatClass = FORMAT_COLORS[book.format] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'

  return (
    <div className="group relative">
      {/* Delete button — visible on hover */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="absolute -top-1.5 -right-1.5 z-10 p-0.5 rounded-full
                   bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                   text-gray-400 hover:text-red-500 hover:border-red-300
                   opacity-0 group-hover:opacity-100 transition-all shadow-sm"
        title="Remove from library"
      >
        <X size={14} />
      </button>

      <div
        onClick={onClick}
        className="cursor-pointer rounded-lg border border-gray-200 dark:border-gray-800
                   hover:border-scroll-300 dark:hover:border-scroll-700
                   hover:shadow-md transition-all duration-200 bg-white dark:bg-gray-900
                   overflow-hidden h-full"
      >
        {/* Cover */}
        <div className="aspect-[3/4] bg-gradient-to-br from-gray-100 to-gray-200
                        dark:from-gray-800 dark:to-gray-700
                        flex items-center justify-center relative overflow-hidden">
          {book.coverUrl ? (
            <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
          ) : (
            <div className="text-center p-4">
              <div className="text-3xl font-bold text-gray-300 dark:text-gray-600 mb-2">
                {book.format}
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 line-clamp-3">
                {book.title}
              </div>
            </div>
          )}

          <span className={`absolute top-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded ${formatClass}`}>
            {book.format}
          </span>

          {/* Douban rating badge — bottom left */}
          {book.doubanRating != null && (
            <div className="absolute bottom-6 left-1.5 flex items-center gap-0.5 bg-black/60 text-yellow-400
                            text-[11px] font-medium px-1.5 py-0.5 rounded">
              <Star size={11} fill="currentColor" />
              {book.doubanRating.toFixed(1)}
            </div>
          )}

          {/* Progress bar — always visible */}
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-200 dark:bg-gray-700">
            <div
              className={`h-full transition-all ${book.progress >= 100 ? 'bg-green-500' : 'bg-scroll-500'}`}
              style={{ width: `${Math.min(book.progress, 100)}%` }}
            />
          </div>
        </div>

        {/* Info */}
        <div className="p-3">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {book.title}
          </h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
            {book.progress >= 100 ? 'Read' : book.progress > 0 ? `${book.progress}%` : book.author}
          </p>
        </div>
      </div>
    </div>
  )
}
