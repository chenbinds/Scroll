import { useState } from 'react'
import { X, Star, RefreshCw } from 'lucide-react'
import type { Book } from '../../stores/appStore'
import { useI18n } from '../../lib/i18n'

const FORMAT_COLORS: Record<string, string> = {
  PDF: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  EPUB: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  MOBI: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  TXT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  MD: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  CBZ: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  DJVU: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
}

type RatingError = 'network' | 'timeout' | 'blocked' | 'not_found' | 'http'

interface Props {
  book: Book
  onClick: () => void
  onDelete: () => void
  onRefreshRating?: () => Promise<{ rating: number } | { error: RatingError }>
}

export default function BookCard({ book, onClick, onDelete, onRefreshRating }: Props) {
  const { t } = useI18n()
  const [ratingBusy, setRatingBusy] = useState(false)
  const [ratingError, setRatingError] = useState<RatingError | null>(null)
  const formatClass = FORMAT_COLORS[book.format] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  const hasRating = book.doubanRating != null && book.doubanRating > 0

  const errorLabel = (err: RatingError) => {
    switch (err) {
      case 'network':
      case 'timeout':
        return t('library.ratingNetworkError')
      case 'blocked':
        return t('library.ratingBlocked')
      case 'not_found':
        return t('library.ratingNotFound')
      default:
        return t('library.ratingFailed')
    }
  }

  const handleRefreshRating = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onRefreshRating || ratingBusy) return
    setRatingBusy(true)
    setRatingError(null)
    try {
      const result = await onRefreshRating()
      if ('error' in result) {
        setRatingError(result.error)
      }
    } catch {
      setRatingError('network')
    } finally {
      setRatingBusy(false)
    }
  }

  return (
    <div className="group relative">
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="absolute -top-1 -right-1 z-10 p-0.5 rounded-full
                   bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                   text-gray-400 hover:text-red-500 hover:border-red-300
                   opacity-0 group-hover:opacity-100 transition-all shadow-sm"
        title={t('library.remove')}
      >
        <X size={12} />
      </button>

      <div
        onClick={onClick}
        className="cursor-pointer rounded-md border border-gray-200 dark:border-gray-800
                   hover:border-scroll-300 dark:hover:border-scroll-700
                   hover:shadow-md transition-all duration-200 bg-white dark:bg-gray-900
                   overflow-hidden h-full"
      >
        <div className="aspect-[3/4] bg-gradient-to-br from-gray-100 to-gray-200
                        dark:from-gray-800 dark:to-gray-700
                        flex items-center justify-center relative overflow-hidden">
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
              alt=""
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center p-2">
              <div className="text-xl font-bold text-gray-300 dark:text-gray-600 mb-1">
                {book.format}
              </div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500 line-clamp-3">
                {book.title}
              </div>
            </div>
          )}

          <span className={`absolute top-1.5 right-1.5 text-[9px] font-semibold px-1 py-0.5 rounded ${formatClass}`}>
            {book.format}
          </span>

          <button
            type="button"
            onClick={handleRefreshRating}
            disabled={ratingBusy}
            title={ratingError ? errorLabel(ratingError) : t('library.refreshRating')}
            className={`absolute bottom-5 left-1 flex items-center gap-0.5 text-[10px] font-medium px-1 py-0.5 rounded
                        transition-opacity z-[1] max-w-[calc(100%-0.5rem)]
                        ${ratingError
                          ? 'bg-red-600/85 text-white opacity-100'
                          : hasRating
                            ? 'bg-black/60 text-yellow-400'
                            : 'bg-black/40 text-gray-200 opacity-0 group-hover:opacity-100'}`}
          >
            {ratingBusy ? (
              <RefreshCw size={10} className="animate-spin shrink-0" />
            ) : (
              <Star size={10} fill={hasRating && !ratingError ? 'currentColor' : 'none'} className="shrink-0" />
            )}
            <span className="truncate">
              {ratingError
                ? errorLabel(ratingError)
                : hasRating
                  ? book.doubanRating!.toFixed(1)
                  : t('library.fetchRating')}
            </span>
          </button>

          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700">
            <div
              className={`h-full transition-all ${book.progress >= 100 ? 'bg-green-500' : 'bg-scroll-500'}`}
              style={{ width: `${Math.min(book.progress, 100)}%` }}
            />
          </div>
        </div>

        <div className="p-2">
          <h3 className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
            {book.title}
          </h3>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
            {book.progress >= 100 ? 'Read' : book.progress > 0 ? `${book.progress}%` : book.author}
          </p>
        </div>
      </div>
    </div>
  )
}
