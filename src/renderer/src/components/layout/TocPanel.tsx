import { useAppStore } from '../../stores/appStore'

export default function TocPanel() {
  const { currentBook, toc, setNavigateToHref } = useAppStore()

  const handleClick = (href: string) => {
    setNavigateToHref(href)
  }

  // No TOC data yet
  if (toc.length === 0) {
    return (
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          {currentBook?.title || '...'}
        </h3>
        <div className="text-sm text-gray-400 dark:text-gray-500 space-y-2">
          <p>TOC will appear after opening an EPUB file.</p>
          <p className="text-xs">PDF TOC support coming in a future update.</p>
        </div>
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
              onClick={() => handleClick(item.href)}
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
                onClick={() => handleClick(sub.href)}
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
