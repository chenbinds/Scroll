import { useAppStore } from '../../stores/appStore'
import { useI18n } from '../../lib/i18n'

export default function TocPanel() {
  const { t } = useI18n()
  const { currentBook, toc } = useAppStore()

  const handleClick = (spineIndex: number) => {
    // Direct call — bypasses useEffect/state cycle entirely
    const navFn = useAppStore.getState()._navFn
    if (navFn) {
      navFn(spineIndex)
    } else {
      // Fallback: use the old state-based approach
      useAppStore.getState().setNavigateToSpineIndex(spineIndex)
    }
  }

  if (toc.length === 0) {
    const isReader = useAppStore.getState().currentView === 'reader'
    const format = useAppStore.getState().currentBook?.format?.toUpperCase()
    const supportsToc = format === 'EPUB' || format === 'TXT' || format === 'MD' || format === 'MARKDOWN'

    if (!isReader || !supportsToc) {
      return (
        <div className="p-4">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {t('reader.placeholder.epub')}
          </p>
        </div>
      )
    }

    return (
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          {currentBook?.title || '...'}
        </h3>
        <div className="mt-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                 style={{ width: `${60 + Math.random() * 40}%`, marginLeft: i > 2 ? '16px' : '0' }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-3">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 px-1">
        {currentBook?.title || 'Contents'}
      </h3>
      <nav className="space-y-0.5">
        {toc.map((item, i) => (
          <div key={i}>
            <button
              onClick={() => handleClick(item.spineIndex)}
              className="w-full text-left text-sm text-gray-600 dark:text-gray-400
                         hover:text-scroll-600 dark:hover:text-scroll-400
                         hover:bg-scroll-50 dark:hover:bg-scroll-900/20
                         rounded px-2 py-1.5 transition-colors truncate"
            >
              {item.label}
            </button>
            {item.subitems?.map((sub, j) => (
              <button
                key={j}
                onClick={() => handleClick(sub.spineIndex)}
                className="w-full text-left text-xs text-gray-500 dark:text-gray-500
                           hover:text-scroll-600 dark:hover:text-scroll-400
                           hover:bg-scroll-50 dark:hover:bg-scroll-900/20
                           rounded pl-6 pr-2 py-1 transition-colors truncate"
              >
                {sub.label}
              </button>
            ))}
          </div>
        ))}
      </nav>
    </div>
  )
}
