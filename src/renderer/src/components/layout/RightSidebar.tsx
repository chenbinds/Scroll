import { X, MessageCircle } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useI18n } from '../../lib/i18n'
import AiPanel from '../ai/AiPanel'

export default function RightSidebar() {
  const { t } = useI18n()
  const { toggleRightSidebar } = useAppStore()

  return (
    <aside className="w-80 border-l border-gray-200 dark:border-gray-800 flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden flex-shrink-0">
      <div className="h-10 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-3">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
          <MessageCircle size={14} className="text-scroll-500" />
          {t('app.ai')}
        </span>
        <button
          onClick={toggleRightSidebar}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <AiPanel />
      </div>
    </aside>
  )
}
