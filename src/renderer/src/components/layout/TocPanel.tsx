import { useAppStore } from '../../stores/appStore'
import { useI18n } from '../../lib/i18n'
import { scrollReaderToHref } from '../../lib/readerLinkNavigation'

// Recursive TOC item renderer
function TocItemRow({ item, depth, onClick }: {
  item: { label: string; href: string; spineIndex: number; subitems?: any[] }
  depth: number
  onClick: (idx: number, href: string) => void
}) {
  const padLeft = 16 + depth * 16
  return (
    <div>
      <button
        onClick={() => onClick(item.spineIndex, item.href)}
        className="w-full text-left text-sm text-gray-600 dark:text-gray-400
                   hover:text-scroll-600 dark:hover:text-scroll-400
                   hover:bg-scroll-50 dark:hover:bg-scroll-900/20
                   rounded px-2 py-1.5 transition-colors truncate"
        style={{ paddingLeft: `${padLeft}px` }}
      >
        {item.label}
      </button>
      {item.subitems?.map((sub: any, j: number) => (
        <TocItemRow key={j} item={sub} depth={depth + 1} onClick={onClick} />
      ))}
    </div>
  )
}

export default function TocPanel() {
  const { t } = useI18n()
  const { currentBook, toc } = useAppStore()

  const handleClick = (spineIndex: number, href: string) => {
    const readerEl = useAppStore.getState()._readerEl
    if (!readerEl) return

    // Prefer path/#fragment resolution (same as in-content links)
    if (href && scrollReaderToHref(readerEl, href)) return

    // Fallback: spine index only
    const chapter = readerEl.querySelector(`[data-chapter="${spineIndex}"]`)
      || readerEl.querySelector(`[data-id="chapter-${spineIndex}"]`)
    if (chapter) {
      chapter.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  if (toc.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-gray-400 dark:text-gray-500">
          {currentBook
            ? `${currentBook.title} — ${currentBook.format}`
            : t('reader.placeholder.epub')}
        </p>
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
          <TocItemRow key={i} item={item} depth={0} onClick={handleClick} />
        ))}
      </nav>
    </div>
  )
}
