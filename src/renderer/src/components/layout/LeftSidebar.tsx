import { X, FileText, Bookmark } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useI18n } from '../../lib/i18n'
import TocPanel from './TocPanel'
import BookmarkPanel from './BookmarkPanel'

export default function LeftSidebar() {
  const { t } = useI18n()
  const { leftSidebarTab, toggleLeftSidebar } = useAppStore()

  return (
    <aside className="w-72 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden flex-shrink-0">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => toggleLeftSidebar('toc')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
            leftSidebarTab === 'toc'
              ? 'text-scroll-600 dark:text-scroll-400 border-b-2 border-scroll-500 bg-white dark:bg-gray-900'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
        >
          <FileText size={14} />
          {t('app.toc')}
        </button>
        <button
          onClick={() => toggleLeftSidebar('bookmarks')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
            leftSidebarTab === 'bookmarks'
              ? 'text-scroll-600 dark:text-scroll-400 border-b-2 border-scroll-500 bg-white dark:bg-gray-900'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
        >
          <Bookmark size={14} />
          {t('app.bookmarks')}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {leftSidebarTab === 'toc' && <TocPanel />}
        {leftSidebarTab === 'bookmarks' && <BookmarkPanel />}
      </div>
    </aside>
  )
}
