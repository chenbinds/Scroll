import { useState } from 'react'
import { X, Star, RefreshCw, ImageIcon } from 'lucide-react'
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
  onSetManualRating?: (rating: number | null) => void
  onRefreshCover?: () => Promise<void>
}

export default function BookCard({ book, onClick, onDelete, onRefreshRating, onSetManualRating, onRefreshCover }: Props) {
  const { t } = useI18n()
  const [ratingBusy, setRatingBusy] = useState(false)
  const [coverBusy, setCoverBusy] = useState(false)
  const [ratingError, setRatingError] = useState<RatingError | null>(null)
  const [coverError, setCoverError] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualValue, setManualValue] = useState('')
  const [manualError, setManualError] = useState<string | null>(null)
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

  const openManualDialog = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!onSetManualRating) return
    setManualValue(hasRating ? String(book.doubanRating) : '')
    setManualError(null)
    setManualOpen(true)
  }

  const handleRefreshRating = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (e.shiftKey || e.altKey || e.ctrlKey || ratingError) {
      openManualDialog(e)
      return
    }
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

  const submitManualRating = () => {
    if (!onSetManualRating) return
    const trimmed = manualValue.trim()
    if (!trimmed) {
      onSetManualRating(null)
      setRatingError(null)
      setManualOpen(false)
      return
    }
    const n = Number(trimmed)
    if (!Number.isFinite(n) || n < 0 || n > 10) {
      setManualError(t('library.manualRatingInvalid'))
      return
    }
    onSetManualRating(Math.round(n * 10) / 10)
    setRatingError(null)
    setManualOpen(false)
  }

  const handleRefreshCover = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onRefreshCover || coverBusy) return
    setCoverBusy(true)
    setCoverError(false)
    try {
      await onRefreshCover()
    } catch {
      setCoverError(true)
    } finally {
      setCoverBusy(false)
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
            <div className="text-center p-2 relative w-full h-full flex flex-col items-center justify-center">
              <div className="text-xl font-bold text-gray-300 dark:text-gray-600 mb-1">
                {book.format}
              </div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500 line-clamp-3">
                {book.title}
              </div>
              {onRefreshCover && (
                <button
                  type="button"
                  onClick={handleRefreshCover}
                  disabled={coverBusy}
                  title={coverError ? t('library.coverFailed') : t('library.refreshCover')}
                  className={`absolute top-1.5 left-1.5 p-1 rounded text-[10px] transition-opacity
                    ${coverError ? 'bg-red-600/85 text-white opacity-100' : 'bg-black/50 text-white opacity-0 group-hover:opacity-100'}`}
                >
                  {coverBusy ? <RefreshCw size={10} className="animate-spin" /> : <ImageIcon size={10} />}
                </button>
              )}
            </div>
          )}

          <span className={`absolute top-1.5 right-1.5 text-[9px] font-semibold px-1 py-0.5 rounded ${formatClass}`}>
            {book.format}
          </span>

          <button
            type="button"
            onClick={handleRefreshRating}
            disabled={ratingBusy}
            title={
              ratingError
                ? t('library.manualRatingHint')
                : `${t('library.refreshRating')} · ${t('library.manualRatingHint')}`
            }
            className={`absolute bottom-5 left-1 flex items-center gap-0.5 text-[10px] font-medium px-1 py-0.5 rounded
                        transition-opacity z-[1] max-w-[calc(100%-0.5rem)]
                        ${ratingError
                          ? 'bg-red-600/85 text-white opacity-100 cursor-pointer'
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
                ? t('library.manualRating')
                : hasRating
                  ? book.doubanRating!.toFixed(1)
                  : t('library.fetchRating')}
            </span>
          </button>
          {onSetManualRating && !ratingError && (
            <button
              type="button"
              onClick={openManualDialog}
              title={t('library.manualRatingHint')}
              className="absolute bottom-5 left-[4.5rem] z-[1] text-[9px] px-1 py-0.5 rounded
                         bg-black/40 text-gray-200 opacity-0 group-hover:opacity-100
                         hover:bg-black/60 transition-opacity"
            >
              {t('library.manualRatingShort')}
            </button>
          )}

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

      {manualOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
          onClick={(e) => { e.stopPropagation(); setManualOpen(false) }}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700
                       w-[280px] p-4"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
              {t('library.manualRating')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{book.title}</p>
            {ratingError && (
              <p className="text-xs text-red-500 mb-2">{errorLabel(ratingError)}</p>
            )}
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
              {t('library.manualRatingPrompt')}
            </label>
            <input
              type="number"
              min={0}
              max={10}
              step={0.1}
              autoFocus
              value={manualValue}
              onChange={(e) => { setManualValue(e.target.value); setManualError(null) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitManualRating()
                if (e.key === 'Escape') setManualOpen(false)
              }}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700
                         bg-white dark:bg-gray-800 px-3 py-2 text-sm mb-3
                         text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-scroll-500/50"
            />
            {manualError && (
              <p className="text-xs text-red-500 mb-2">{manualError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setManualOpen(false)}
                className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={submitManualRating}
                className="px-3 py-1.5 text-xs bg-scroll-500 hover:bg-scroll-600 text-white rounded-lg"
              >
                {t('common.ok')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

