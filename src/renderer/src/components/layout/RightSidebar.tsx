import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useI18n } from '../../lib/i18n'
import AiPanel from '../ai/AiPanel'

const WIDTH_KEY = 'scroll-right-sidebar-width'
const DEFAULT_WIDTH = 320 // w-80
const MIN_WIDTH = 240
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

export default function RightSidebar() {
  const { t } = useI18n()
  const { toggleRightSidebar } = useAppStore()
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
      // Drag left edge: moving mouse left increases width
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW - (ev.clientX - startX)))
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

  return (
    <aside
      style={{ width }}
      className="relative border-l border-gray-200 dark:border-gray-800 flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden flex-shrink-0"
    >
      {/* Drag handle — left edge */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        onMouseDown={onResizeStart}
        className="absolute top-0 left-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-scroll-500/40 active:bg-scroll-500/60 transition-colors"
      />

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
