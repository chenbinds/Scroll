import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { parseMobi, type MobiChapter } from '../../lib/mobiParser'
import { useAppStore } from '../../stores/appStore'
import ReaderThemeBar from './ReaderThemeBar'
import { getThemeStyle } from '../../lib/readingTheme'
import { useI18n } from '../../lib/i18n'

interface Props {
  filePath: string
  onClose: () => void
  onProgress?: (chapterIndex: number, chapterCount: number, percent: number) => void
  onTocReady?: (toc: { label: string; href: string; spineIndex: number }[]) => void
  initialProgress?: number
}

export default function MobiReader({ filePath, onClose, onProgress, onTocReady, initialProgress }: Props) {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fontSize, setFontSize] = useState(100)
  const [chapters, setChapters] = useState<MobiChapter[]>([])
  const contentRef = useRef<HTMLDivElement | null>(null)
  const hasRestoredRef = useRef(false)

  // Callback ref: stores DOM el in Zustand for TocPanel
  const setContentRef = useCallback((el: HTMLDivElement | null) => {
    contentRef.current = el
    useAppStore.getState()._setReaderEl(el)
  }, [])

  // Cleanup TOC on unmount
  useEffect(() => {
    return () => { useAppStore.getState().setToc([]) }
  }, [])

  // Load MOBI
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    hasRestoredRef.current = false

    const load = async () => {
      try {
        const base64 = await window.scrollAPI.readFile(filePath)
        if (cancelled) return

        const content = await parseMobi(base64)
        if (cancelled) return

        setTitle(content.metadata.title)
        setAuthor(content.metadata.author)
        setChapters(content.chapters)

        // Build TOC
        const toc = content.chapters.map((ch, i) => ({
          label: ch.title,
          href: `mobi-chapter-${i}`,
          spineIndex: i
        }))
        useAppStore.getState().setToc(toc)
        onTocReady?.(toc)

        // AI context
        if (content.chapters.length > 0) {
          useAppStore.getState().setAiContext({
            chapter: content.chapters[0].title,
            content: content.chapters[0].html.replace(/<[^>]+>/g, '').slice(0, 5000)
          })
        }
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        console.error('MOBI load error:', err)
        const msg = err instanceof Error ? (err.stack || err.message) : String(err)
        console.error('MOBI load error:', msg)
        setError('Failed to load MOBI: ' + msg)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [filePath])

  // Restore reading position
  useEffect(() => {
    if (chapters.length === 0 || hasRestoredRef.current) return

    const pct = initialProgress && initialProgress > 0 && initialProgress < 100 ? initialProgress : null
    if (!pct) { hasRestoredRef.current = true; return }

    hasRestoredRef.current = true

    const tryScroll = (attempts: number) => {
      const container = contentRef.current
      if (!container) {
        if (attempts < 10) setTimeout(() => tryScroll(attempts + 1), 200)
        return
      }
      const total = container.scrollHeight - container.clientHeight
      if (total > 0) {
        container.scrollTop = Math.round((total * pct) / 100)
      }
    }
    setTimeout(() => tryScroll(0), 100)
  }, [chapters, initialProgress])

  // Scroll progress tracking
  useEffect(() => {
    if (!contentRef.current || loading) return
    const el = contentRef.current
    let ticking = false

    const update = () => {
      const total = el.scrollHeight - el.clientHeight
      const pct = total > 0 ? Math.round((el.scrollTop / total) * 100) : 0

      let currentIdx = 0
      const sections = el.querySelectorAll('[data-chapter]')
      const containerRect = el.getBoundingClientRect()
      const viewTop = containerRect.top + containerRect.height * 0.2
      for (const sec of sections) {
        const rect = sec.getBoundingClientRect()
        if (rect.top <= viewTop) currentIdx = Number((sec as HTMLElement).dataset.chapter) || 0
        else break
      }
      onProgress?.(currentIdx, chapters.length, pct)
    }

    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(() => { update(); ticking = false }) }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [loading, chapters, onProgress])

  const increaseFont = useCallback(() => setFontSize((s) => Math.min(s + 10, 200)), [])
  const decreaseFont = useCallback(() => setFontSize((s) => Math.max(s - 10, 60)), [])

  // Bookmark navigation
  const navigateToPercent = useAppStore((s) => s.navigateToPercent)
  const setNavigateToPercent = useAppStore((s) => s.setNavigateToPercent)
  useEffect(() => {
    if (navigateToPercent === null || !contentRef.current) return
    const el = contentRef.current
    const total = el.scrollHeight - el.clientHeight
    if (total > 0) el.scrollTop = Math.round((total * navigateToPercent) / 100)
    setNavigateToPercent(null)
  }, [navigateToPercent, setNavigateToPercent])

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'j') contentRef.current?.scrollBy({ top: 80, behavior: 'smooth' })
      if (e.key === 'ArrowUp' || e.key === 'k') contentRef.current?.scrollBy({ top: -80, behavior: 'smooth' })
      if (e.key === ' ') { e.preventDefault(); contentRef.current?.scrollBy({ top: contentRef.current!.clientHeight * 0.8, behavior: 'smooth' }) }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // Chapter elements — full render, memoized
  const chapterElements = useMemo(() => {
    return chapters.map((ch, i) => (
      <section key={i} data-id={`mobi-chapter-${i}`} data-chapter={i} className="mb-8">
        <h2 className="font-bold text-lg mb-4 text-gray-900 dark:text-gray-100">{ch.title}</h2>
        <div dangerouslySetInnerHTML={{ __html: ch.html }} />
      </section>
    ))
  }, [chapters])

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: themeStyle.backgroundColor }}>
      {/* Toolbar */}
      <div className="h-10 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-3 no-select flex-shrink-0" style={{ backgroundColor: themeStyle.backgroundColor }}>
        <button onClick={onClose}
          className="text-sm transition-colors" style={{ color: themeStyle.color, opacity: 0.7 }}>
          ← {t('app.backToLibrary')}
        </button>
        <span className="text-xs truncate max-w-[300px]" style={{ color: themeStyle.color, opacity: 0.5 }}>{title}</span>
	        <ReaderThemeBar />
        <div className="flex items-center gap-3">
          <button onClick={decreaseFont}
            className="p-1 transition-colors" style={{ color: themeStyle.color, opacity: 0.6 }}>
            <ZoomOut size={16} />
          </button>
          <span className="text-xs text-gray-400 tabular-nums w-10 text-center">{fontSize}%</span>
          <button onClick={increaseFont}
            className="p-1 transition-colors" style={{ color: themeStyle.color, opacity: 0.6 }}>
            <ZoomIn size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div ref={setContentRef} className="flex-1 overflow-auto scrollbar-thin" style={{ backgroundColor: themeStyle.backgroundColor }}>
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
            <div className="text-center text-red-500 px-4">
              <p className="text-sm">Failed to load MOBI</p>
              <p className="text-xs mt-1 text-red-400">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="max-w-4xl mx-auto px-8 py-6 reader-content" style={{ fontSize: `${fontSize}%` }}>
            <h1 className="text-2xl font-bold mb-2 text-center text-gray-900 dark:text-gray-100">{title}</h1>
            {author && author !== 'Unknown Author' && (
              <p className="text-sm text-center text-gray-400 dark:text-gray-600 mb-8">{author}</p>
            )}
            <div className={author && author !== 'Unknown Author' ? '' : 'mt-6'}>
              {chapterElements}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
