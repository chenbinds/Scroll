import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, Bookmark, Search } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useI18n } from '../../lib/i18n'
import TocPanel from './TocPanel'
import BookmarkPanel from './BookmarkPanel'
import SearchPanel from './SearchPanel'

const WIDTH_KEY = 'scroll-left-sidebar-width'
const DEFAULT_WIDTH = 288 // w-72
const MIN_WIDTH = 180
const MAX_WIDTH = 560

function loadWidth(): number {
  try {
    const raw = localStorage.getItem(WIDTH_KEY)
    if (!raw) return DEFAULT_WIDTH
    const n = Number(raw)
    if (!Number.isFinite(n)) return DEFAULT_WIDTH
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, n))
  } catch {
    return DEFAULT_WIDTH
  }
}

export default function LeftSidebar() {
  const { t } = useI18n()
  const { leftSidebarTab, setLeftSidebarTab } = useAppStore()
  const [width, setWidth] = useState(loadWidth)
  const dragging = useRef(false)

  useEffect(() => {
    try {
      localStorage.setItem(WIDTH_KEY, String(width))
    } catch { /* ignore */ }
  }, [width])

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    const startX = e.clientX
    const startW = width

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW + (ev.clientX - startX)))
      setWidth(next)
    }
    const onUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [width])

  const tabClass = (tab: typeof leftSidebarTab) =>
    `flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors ${
      leftSidebarTab === tab
        ? 'text-scroll-600 dark:text-scroll-400 border-b-2 border-scroll-500 chrome-surface-raised'
        : 'chrome-muted hover:opacity-80'
    }`

  return (
    <aside
      style={{ width }}
      className="relative chrome-border-r flex flex-col chrome-surface overflow-hidden flex-shrink-0"
    >
      <div className="flex chrome-border-b">
        <button type="button" onClick={() => setLeftSidebarTab('toc')} className={tabClass('toc')} title={t('app.toc')}>
          <FileText size={14} />
          <span className="truncate">{t('app.toc')}</span>
        </button>
        <button
          type="button"
          onClick={() => setLeftSidebarTab('bookmarks')}
          className={tabClass('bookmarks')}
          title={t('app.bookmarks')}
        >
          <Bookmark size={14} />
          <span className="truncate max-w-[4.5rem]">{t('app.bookmarksShort')}</span>
        </button>
        <button
          type="button"
          onClick={() => setLeftSidebarTab('search')}
          className={tabClass('search')}
          title={t('app.search')}
        >
          <Search size={14} />
          <span className="truncate">{t('app.search')}</span>
        </button>
      </div>

      <div
        className={`flex-1 min-h-0 ${
          leftSidebarTab === 'search' ? 'overflow-hidden' : 'overflow-y-auto'
        }`}
      >
        {leftSidebarTab === 'toc' && <TocPanel />}
        {leftSidebarTab === 'bookmarks' && <BookmarkPanel />}
        {leftSidebarTab === 'search' && <SearchPanel />}
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        onMouseDown={onResizeStart}
        className="absolute top-0 right-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-scroll-500/40 active:bg-scroll-500/60 transition-colors"
      />
    </aside>
  )
}
