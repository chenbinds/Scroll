import { useState, useEffect, useRef, useCallback } from 'react'
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, SkipBack, SkipForward } from 'lucide-react'
import { parseComic, type ComicPage } from '../../lib/comicParser'
import { useAppStore } from '../../stores/appStore'
import { useI18n } from '../../lib/i18n'

interface Props {
  filePath: string
  format: 'CBZ' | 'CBR'
  onClose: () => void
  onPageChange?: (page: number, total: number) => void
  initialPage?: number
}

export default function ComicReader({ filePath, format, onClose, onPageChange, initialPage }: Props) {
  const { t } = useI18n()
  const [pages, setPages] = useState<ComicPage[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const hasRestoredRef = useRef(false)

  // Load comic
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    hasRestoredRef.current = false

    const load = async () => {
      try {
        const base64 = await window.scrollAPI.readFile(filePath)
        if (cancelled) return

        const comicPages = await parseComic(base64, format)
        if (cancelled) return

        setPages(comicPages)
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        console.error('Comic load error:', err)
        setError('Failed to load comic: ' + (err instanceof Error ? err.message : String(err)))
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [filePath, format])

  // Restore page position
  useEffect(() => {
    if (pages.length === 0 || hasRestoredRef.current) return
    hasRestoredRef.current = true

    if (initialPage && initialPage > 1 && initialPage <= pages.length) {
      setCurrentPage(initialPage)
      // Scroll to page
      setTimeout(() => {
        const el = pageRefs.current.get(initialPage)
        if (el) el.scrollIntoView({ block: 'start' })
      }, 200)
    }
  }, [pages, initialPage])

  // Track current page via scroll
  useEffect(() => {
    if (!containerRef.current || pages.length === 0) return
    const container = containerRef.current
    let ticking = false

    const updateVisible = () => {
      const rect = container.getBoundingClientRect()
      const centerY = rect.top + rect.height * 0.3

      let closest = 1
      let closestDist = Infinity
      pageRefs.current.forEach((el, pageNum) => {
        const r = el.getBoundingClientRect()
        const dist = Math.abs(r.top - centerY)
        if (dist < closestDist) { closestDist = dist; closest = pageNum }
      })

      if (closest !== currentPage) {
        setCurrentPage(closest)
        onPageChange?.(closest, pages.length)
      }
    }

    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(() => { updateVisible(); ticking = false }) }
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [pages, currentPage, onPageChange])

  // Navigation
  const goToPage = useCallback((page: number) => {
    const p = Math.max(1, Math.min(page, pages.length))
    setCurrentPage(p)
    const el = pageRefs.current.get(p)
    if (el) el.scrollIntoView({ block: 'start' })
  }, [pages.length])

  const prevPage = useCallback(() => goToPage(currentPage - 1), [currentPage, goToPage])
  const nextPage = useCallback(() => goToPage(currentPage + 1), [currentPage, goToPage])
  const zoomIn = useCallback(() => setScale((s) => Math.round(Math.min(s + 0.25, 3.0) * 100) / 100), [])
  const zoomOut = useCallback(() => setScale((s) => Math.round(Math.max(s - 0.25, 0.25) * 100) / 100), [])

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'l') nextPage()
      if (e.key === 'ArrowLeft' || e.key === 'h') prevPage()
      if (e.key === 'ArrowDown' || e.key === 'j') containerRef.current?.scrollBy({ top: 200, behavior: 'smooth' })
      if (e.key === 'ArrowUp' || e.key === 'k') containerRef.current?.scrollBy({ top: -200, behavior: 'smooth' })
      if (e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); nextPage() }
      if (e.key === 'PageUp') { e.preventDefault(); prevPage() }
      if (e.key === 'Home') goToPage(1)
      if (e.key === 'End') goToPage(pages.length)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [prevPage, nextPage, goToPage, pages.length])

  return (
    <div className="h-full flex flex-col bg-gray-100 dark:bg-gray-950">
      {/* Top toolbar */}
      <div className="h-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800
                      flex items-center justify-between px-3 no-select flex-shrink-0">
        <button onClick={onClose}
          className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
          ← {t('app.backToLibrary')}
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 tabular-nums">{currentPage} / {pages.length}</span>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={zoomOut}
            className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
            <ZoomOut size={16} />
          </button>
          <span className="text-xs text-gray-400 tabular-nums w-10 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button onClick={zoomIn}
            className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
            <ZoomIn size={16} />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div ref={containerRef} className="flex-1 overflow-auto scrollbar-thin">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 bg-scroll-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2.5 h-2.5 bg-scroll-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2.5 h-2.5 bg-scroll-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-red-500 px-6 max-w-md">
              <p className="text-sm">{error}</p>
              <button onClick={onClose} className="mt-3 text-xs text-scroll-500 hover:underline">
                {t('app.backToLibrary')}
              </button>
            </div>
          </div>
        )}

        {!loading && !error && pages.map((page, i) => {
          const pageNum = i + 1
          return (
            <div
              key={pageNum}
              ref={(el) => { if (el) pageRefs.current.set(pageNum, el); else pageRefs.current.delete(pageNum) }}
              data-page={pageNum}
              className="flex justify-center py-2"
            >
              <img
                src={page.dataUrl}
                alt={page.name}
                className="shadow-lg bg-white select-none"
                style={{
                  width: `${scale * 100}%`,
                  maxWidth: `${scale * 100}%`,
                  height: 'auto'
                }}
                draggable={false}
              />
            </div>
          )
        })}
      </div>

      {/* Bottom navigation bar */}
      {!loading && !error && pages.length > 0 && (
        <div className="h-10 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800
                        flex items-center justify-center gap-4 no-select flex-shrink-0">
          <button onClick={() => goToPage(1)} disabled={currentPage === 1}
            className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-30 transition-colors">
            <SkipBack size={16} />
          </button>
          <button onClick={prevPage} disabled={currentPage === 1}
            className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-30 transition-colors">
            <ChevronLeft size={18} />
          </button>

          <span className="text-xs text-gray-500 tabular-nums w-24 text-center select-text">
            {currentPage} / {pages.length}
          </span>

          <button onClick={nextPage} disabled={currentPage === pages.length}
            className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-30 transition-colors">
            <ChevronRight size={18} />
          </button>
          <button onClick={() => goToPage(pages.length)} disabled={currentPage === pages.length}
            className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-30 transition-colors">
            <SkipForward size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
