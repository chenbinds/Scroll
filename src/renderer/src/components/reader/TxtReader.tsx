import { useState, useEffect, useRef, useCallback } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { parseTxt, type TxtChapter } from '../../lib/txtParser'
import { useAppStore } from '../../stores/appStore'
import { useReaderFontSize } from '../../lib/useReaderFontSize'
import ReaderThemeBar from './ReaderThemeBar'
import BackToLibraryButton from './BackToLibraryButton'
import { useI18n } from '../../lib/i18n'

interface Props {
  filePath: string
  onClose: () => void
  onProgress?: (pct: number) => void
  initialProgress?: number
}

export default function TxtReader({ filePath, onClose, onProgress, initialProgress }: Props) {
  const { t } = useI18n()
  const [chapters, setChapters] = useState<TxtChapter[]>([])
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { fontSize, increaseFont, decreaseFont } = useReaderFontSize()
  const contentRef = useRef<HTMLDivElement | null>(null)
  const hasRestoredRef = useRef(false)

  // Callback ref: stores DOM el in Zustand for TocPanel
  const setContentRef = useCallback((el: HTMLDivElement | null) => {
    contentRef.current = el
    useAppStore.getState()._setReaderEl(el)
  }, [])

  useEffect(() => {
    return () => { useAppStore.getState().setToc([]) }
  }, [])

  // Load TXT
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    hasRestoredRef.current = false

    const load = async () => {
      try {
        const base64 = await window.scrollAPI.readFile(filePath)
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
        const text = new TextDecoder('utf-8').decode(bytes)
        if (cancelled) return

        const parsed = parseTxt(text)
        if (cancelled) return

        const fileName = filePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') || 'Untitled'
        setTitle(fileName)
        setChapters(parsed)

        // TOC to sidebar
        useAppStore.getState().setToc(parsed.map((ch, i) => ({
          label: ch.title,
          href: `chapter-${i}`,
          spineIndex: i
        })))

        // AI context
        if (parsed.length > 0) {
          useAppStore.getState().setAiContext({
            chapter: parsed[0].title,
            content: parsed[0].content.slice(0, 5000)
          })
        }

        setLoading(false)
      } catch (err) {
        if (cancelled) return
        setError('Failed to load file.')
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [filePath])

  // Restore reading position
  useEffect(() => {
    if (chapters.length === 0 || !contentRef.current || hasRestoredRef.current) return
    if (!initialProgress || initialProgress <= 0 || initialProgress >= 100) return

    hasRestoredRef.current = true
    requestAnimationFrame(() => {
      const el = contentRef.current
      if (!el) return
      const total = el.scrollHeight - el.clientHeight
      if (total > 0) el.scrollTop = Math.round((total * initialProgress) / 100)
    })
  }, [chapters, initialProgress])

  // Scroll progress
  useEffect(() => {
    if (!contentRef.current || loading) return
    const el = contentRef.current
    let ticking = false

    const update = () => {
      const total = el.scrollHeight - el.clientHeight
      const pct = total > 0 ? Math.round((el.scrollTop / total) * 100) : 0
      onProgress?.(pct)
    }

    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(() => { update(); ticking = false }) }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [loading, chapters, onProgress])

  // Bookmark navigation
  const navigateToPercent = useAppStore((s) => s.navigateToPercent)
  const setNavigateToPercent = useAppStore((s) => s.setNavigateToPercent)
  useEffect(() => {
    if (navigateToPercent === null || !contentRef.current) return
    const el = contentRef.current
    const total = el.scrollHeight - el.clientHeight
    if (total > 0) el.scrollTop = Math.round((total * navigateToPercent) / 100)
    setNavigateToPercent(null)
  }, [navigateToPercent])

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

  return (
    <div className="reader-frame">
      <div className="reader-toolbar">
        <BackToLibraryButton onClick={onClose} />
          <ReaderThemeBar />
          
        <div className="flex items-center gap-3">
          <button onClick={decreaseFont} className="p-1 chrome-muted hover:opacity-80 transition-colors">
            <ZoomOut size={16} />
          </button>
          <span className="text-xs chrome-muted tabular-nums w-10 text-center">{fontSize}%</span>
          <button onClick={increaseFont} className="p-1 chrome-muted hover:opacity-80 transition-colors">
            <ZoomIn size={16} />
          </button>
        </div>
      </div>

      <div ref={setContentRef} className="reader-scroll scrollbar-thin">
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
            <div className="text-center text-red-500"><p className="text-sm">{error}</p></div>
          </div>
        )}
        {!loading && !error && (
          <div className="max-w-4xl mx-auto px-8 py-6 reader-content" style={{ fontSize: `${fontSize}%` }}>
            <h1 className="text-2xl font-bold mb-8 text-center">{title}</h1>
            {chapters.map((ch, i) => (
              <section key={i} data-id={`chapter-${i}`} className="mb-8">
                {chapters.length > 1 && (
                  <h2 className="font-bold text-lg mb-4">{ch.title}</h2>
                )}
                {ch.content.split('\n').map((para, j) =>
                  para.trim() ? <p key={j}>{para}</p> : <br key={j} />
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
