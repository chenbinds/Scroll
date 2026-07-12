import { useState, useEffect, useRef, useCallback } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import { useAppStore } from '../../stores/appStore'
import DoubanBadge from './DoubanBadge'
import ReaderThemeBar from './ReaderThemeBar'
import { useI18n } from '../../lib/i18n'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

const RENDER_QUALITY = 2 // extra sharpness multiplier

interface Props {
  filePath: string
  onClose: () => void
  onPageChange?: (page: number, total: number) => void
  initialPage?: number
}

export default function PdfReader({ filePath, onClose, onPageChange, initialPage }: Props) {
  const { t } = useI18n()
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [scale, setScale] = useState(1.5)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set([1]))
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const coverCapturedRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Load PDF
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const loadPdf = async () => {
      try {
        const base64 = await window.scrollAPI.readFile(filePath)
        const binaryStr = atob(base64)
        const bytes = new Uint8Array(binaryStr.length)
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)

        const doc = await pdfjsLib.getDocument({ data: bytes }).promise
        if (cancelled) return
        setPdfDoc(doc)
        setPageCount(doc.numPages)
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        console.error('PDF load error:', err)
        setError('Failed to load PDF.')
        setLoading(false)
      }
    }
    loadPdf()
    return () => { cancelled = true }
  }, [filePath])

  // Track visible pages for progress display
  useEffect(() => {
    if (!containerRef.current || pageCount === 0) return

    const container = containerRef.current
    let ticking = false

    const updateVisiblePage = () => {
      const sentinel = container.querySelector('[data-page]') as HTMLElement | null
      if (!sentinel) return
      const rect = container.getBoundingClientRect()
      const centerY = rect.top + rect.height * 0.3 // 30% from top = "current page"

      let closestPage = 1
      let closestDist = Infinity
      container.querySelectorAll('[data-page]').forEach((el) => {
        const r = el.getBoundingClientRect()
        const dist = Math.abs(r.top - centerY)
        if (dist < closestDist) {
          closestDist = dist
          closestPage = Number((el as HTMLElement).dataset.page)
        }
      })

      onPageChange?.(closestPage, pageCount)
    }

    let progressTicking = false
    let lastUpdate = 0
    const onScroll = () => {
      if (!progressTicking) {
        progressTicking = true
        requestAnimationFrame(() => {
          const now = Date.now()
          if (now - lastUpdate >= 500) {
            lastUpdate = now
            updateVisiblePage()
          }
          progressTicking = false
        })
      }
    }

    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [pageCount, onPageChange])

  // Render a single page to its canvas
  const renderPageToCanvas = useCallback(async (pageNum: number) => {
    if (!pdfDoc) return
    const canvas = canvasRefs.current.get(pageNum)
    if (!canvas) return

    try {
      const page = await pdfDoc.getPage(pageNum)
      const dpr = window.devicePixelRatio || 1
      const pixelRatio = Math.max(dpr * RENDER_QUALITY, 2)
      const viewport = page.getViewport({ scale: scale * pixelRatio })
      const ctx = canvas.getContext('2d')!

      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.style.width = `${viewport.width / pixelRatio}px`
      canvas.style.height = `${viewport.height / pixelRatio}px`

      await page.render({ canvasContext: ctx, viewport }).promise
      setRenderedPages((prev) => new Set(prev).add(pageNum))
      // Capture page 1 as cover thumbnail
      if (pageNum === 1 && !coverCapturedRef.current && useAppStore.getState().currentBook?.format === 'PDF') {
        coverCapturedRef.current = true
        try {
          const thumbCanvas = document.createElement('canvas')
          const thumbCtx = thumbCanvas.getContext('2d')!
          const thumbW = 240, thumbH = Math.round(240 * (viewport.height / viewport.width))
          thumbCanvas.width = thumbW; thumbCanvas.height = thumbH
          thumbCtx.drawImage(canvas, 0, 0, thumbW, thumbH)
          const dataUrl = thumbCanvas.toDataURL('image/jpeg', 0.7)
          const st = useAppStore.getState()
          st.setBooks(st.books.map((b) => b.id === st.currentBook!.id ? { ...b, coverUrl: dataUrl } : b))
        } catch (_) {}
      }
    } catch (err) {
      console.error(`Page ${pageNum} render error:`, err)
    }
  }, [pdfDoc, scale])

  // Re-render all already-rendered pages when scale changes
  useEffect(() => {
    if (!pdfDoc) return
    renderedPages.forEach((pageNum) => {
      renderPageToCanvas(pageNum)
    })
  }, [scale])

  // Set up IntersectionObserver for lazy rendering
  const setCanvasRef = useCallback((pageNum: number, el: HTMLCanvasElement | null) => {
    if (el) {
      canvasRefs.current.set(pageNum, el)
      if (!observerRef.current) {
        observerRef.current = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                const pn = Number((entry.target as HTMLElement).dataset.page)
                if (pn && !renderedPages.has(pn)) {
                  renderPageToCanvas(pn)
                }
              }
            })
          },
          { rootMargin: '600px' } // render 600px ahead of viewport
        )
      }
      observerRef.current.observe(el)
    }
  }, [renderedPages, renderPageToCanvas])

  // Render first page, then restore saved position
  useEffect(() => {
    if (!pdfDoc || pageCount === 0) return
    renderPageToCanvas(1)
    if (!initialPage || initialPage <= 1) return

    // Render target page and surrounding pages, then scroll
    const start = Math.max(1, initialPage - 2)
    const end = Math.min(pageCount, initialPage + 2)
    const pagesToRender = []
    for (let p = start; p <= end; p++) {
      if (p !== 1) pagesToRender.push(renderPageToCanvas(p))
    }
    Promise.all(pagesToRender).then(() => {
      setTimeout(() => {
        const el = containerRef.current?.querySelector(`[data-page="${initialPage}"]`)
        if (el) el.scrollIntoView({ block: 'start' })
      }, 200)
    })
  }, [pdfDoc, pageCount])

  // Cleanup observer
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect()
      observerRef.current = null
    }
  }, [])

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') containerRef.current?.scrollBy({ top: 80, behavior: 'smooth' })
      if (e.key === 'ArrowUp') containerRef.current?.scrollBy({ top: -80, behavior: 'smooth' })
      if (e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault()
        containerRef.current?.scrollBy({ top: containerRef.current.clientHeight * 0.8, behavior: 'smooth' })
      }
      if (e.key === 'PageUp') {
        e.preventDefault()
        containerRef.current?.scrollBy({ top: -containerRef.current.clientHeight * 0.8, behavior: 'smooth' })
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const zoomIn = useCallback(() => setScale((s) => Math.round(Math.min(s + 0.25, 3.0) * 100) / 100), [])
  const zoomOut = useCallback(() => setScale((s) => Math.round(Math.max(s - 0.25, 0.5) * 100) / 100), [])

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-950">
      {/* Top toolbar */}
      <div className="h-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800
                      flex items-center justify-between px-3 no-select flex-shrink-0">
        <button onClick={onClose}
          className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
          ← {t('app.backToLibrary')}
        </button>

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

        <div className="w-16" />
      </div>

      {/* Scrollable content */}
      <div ref={containerRef}
        className="flex-1 overflow-auto scrollbar-thin">
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
            <div className="text-center text-red-500">
              <p className="text-sm">{error}</p>
              <button onClick={onClose} className="mt-3 text-xs text-scroll-500 hover:underline">
                Back to library
              </button>
            </div>
          </div>
        )}

        {!loading && !error && Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNum) => (
          <div key={pageNum} data-page={pageNum}
            className="flex justify-center py-2">
            <canvas
              ref={(el) => setCanvasRef(pageNum, el)}
              data-page={pageNum}
              className="shadow-lg bg-white"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
