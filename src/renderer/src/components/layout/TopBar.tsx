import { Book, Settings, Bookmark, MessageCircle, FileText, Music } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useMusicStore } from '../../stores/musicStore'
import { useI18n } from '../../lib/i18n'

interface Props {
  onOpenSettings: () => void
}

export default function TopBar({ onOpenSettings }: Props) {
  const { t } = useI18n()
  const {
    currentView,
    leftSidebarOpen, leftSidebarTab, toggleLeftSidebar,
    rightSidebarOpen, toggleRightSidebar
  } = useAppStore()
  const { isExpanded, setExpanded, setShowMiniPlayer, isPlaying } = useMusicStore()

  return (
    <header className={`h-12 flex items-center justify-between px-4 no-select chrome-border-b ${
      currentView === 'reader'
        ? 'chrome-surface text-[var(--reader-text)]'
        : 'bg-white dark:bg-gray-950 border-b border-gray-300 dark:border-gray-700'
    }`}>
      <div className="flex items-center gap-3">
        {currentView === 'library' && (
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Book size={18} className="text-scroll-500" />
            {t('app.title')}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-1">
        {currentView === 'reader' && (
          <>
            {/* Left sidebar toggles: TOC + Bookmarks */}
            <button
              onClick={() => toggleLeftSidebar('toc')}
              className={`p-2 rounded-md transition-colors ${
                leftSidebarOpen && leftSidebarTab === 'toc'
                  ? 'bg-scroll-100 dark:bg-scroll-900 text-scroll-600'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              title={t('app.toc')}
            >
              <FileText size={18} />
            </button>
            <button
              onClick={() => toggleLeftSidebar('bookmarks')}
              className={`p-2 rounded-md transition-colors ${
                leftSidebarOpen && leftSidebarTab === 'bookmarks'
                  ? 'bg-scroll-100 dark:bg-scroll-900 text-scroll-600'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              title={t('app.bookmarks')}
            >
              <Bookmark size={18} />
            </button>

            <div className="chrome-divider" />

            {/* Right sidebar toggle: AI */}
            <button
              onClick={toggleRightSidebar}
              className={`p-2 rounded-md transition-colors ${
                rightSidebarOpen
                  ? 'bg-scroll-100 dark:bg-scroll-900 text-scroll-600'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              title={t('app.ai')}
            >
              <MessageCircle size={18} />
            </button>
            <div className="chrome-divider" />
          </>
        )}

        <button
          onClick={() => {
            if (isExpanded) setExpanded(false)
            else { setShowMiniPlayer(true); setExpanded(true) }
          }}
          className={`p-2 rounded-md transition-colors ${
            isPlaying ? 'text-scroll-500'
              : isExpanded ? 'bg-scroll-100 dark:bg-scroll-900 text-scroll-600'
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          title={t('app.music')}
        >
          <Music size={18} />
        </button>

        <button
          onClick={onOpenSettings}
          className="p-2 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={t('app.settings') + ' (Ctrl+Shift+S)'}
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  )
}
