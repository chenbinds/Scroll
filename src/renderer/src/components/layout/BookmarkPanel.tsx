import { X, BookmarkPlus, ArrowRight } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useI18n } from '../../lib/i18n'

export default function BookmarkPanel() {
  const { t } = useI18n()
  const { bookmarks, addBookmark, removeBookmark, readingPosition, setNavigateToPercent, currentBook } = useAppStore()

  const handleAdd = () => {
    const now = new Date()
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    const label = `${timeStr} - ${readingPosition.percent}%`
    addBookmark({
      label,
      percent: readingPosition.percent,
      time: Date.now()
    })
  }

  const handleNavigate = (percent: number | undefined) => {
    if (percent !== undefined) {
      setNavigateToPercent(percent)
    }
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200 dark:border-gray-800">
        <button onClick={handleAdd}
          className="w-full py-2 text-sm text-scroll-600 dark:text-scroll-400
                     border border-dashed border-scroll-300 dark:border-scroll-700
                     rounded-lg hover:bg-scroll-50 dark:hover:bg-scroll-900/20
                     transition-colors flex items-center justify-center gap-1.5">
          <BookmarkPlus size={14} />
          {t('app.bookmarks')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {bookmarks.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-400 dark:text-gray-600">
            <p>{t('music.empty')}</p>
          </div>
        ) : (
          bookmarks.map((bm, i) => (
            <div key={i}
              onClick={() => handleNavigate(bm.percent)}
              className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-gray-800/50
                         hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors group cursor-pointer">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{bm.label}</p>
                <p className="text-xs text-gray-400 dark:text-gray-600">
                  {bm.percent !== undefined ? `${bm.percent}%` : (bm.page ? `Page ${bm.page}` : '')}
                  {' · '}{formatTime(bm.time)}
                </p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); removeBookmark(i) }}
                className="p-0.5 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                <X size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
