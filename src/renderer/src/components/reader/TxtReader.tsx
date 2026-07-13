import { useState, useEffect, useRef, useCallback } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { parseTxt, type TxtChapter } from '../../lib/txtParser'
import { useAppStore } from '../../stores/appStore'
import { useReaderFontSize } from '../../lib/useReaderFontSize'
import { useAnnotationStore } from '../../stores/annotationStore'
import { annotationFormatForBook } from '../../lib/annotationTypes'
import ReaderThemeBar from './ReaderThemeBar'
import BackToLibraryButton from './BackToLibraryButton'
import AnnotationToolbar from './annotation/AnnotationToolbar'
import AnnotationOverlay from './annotation/AnnotationOverlay'
import HighlightLayer from './annotation/HighlightLayer'
import MarkSelectionHandler from './annotation/MarkSelectionHandler'

interface Props {
  filePath: string
  onClose: () => void
  onProgress?: (pct: number) => void
  initialProgress?: number
}

export default function TxtReader({ filePath, onClose, onProgress, initialProgress }: Props) {
  const [chapters, setChapters] = useState<TxtChapter[]>([])
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { fontSize, increaseFont, decreaseFont } = useReaderFontSize()
  const contentRef = useRef<HTMLDivElement | null>(null)
  const hasRestoredRef = useRef(false)
  const currentBook = useAppStore((s) => s.currentBook)

  const setContentRef = useCallback((el: HTMLDivElement | null) => {
    contentRef.current = el
    useAppStore.getState()._setReaderEl(el)
  }, [])

  useEffect(() => {
    return () => { useAppStore.getState().setToc([]) }
  }, [])

  useEffect(() => {
    if (!currentBook?.id) return
    void useAnnotationStore.getState().loadForBook(
      currentBook.id,
      annotationFormatForBook(currentBook.format)
    )
    return () => { useAnnotationStore.getState().reset() }
  }, [currentBook?.id, currentBook?.format])

  const requestClose = useCallback(() => {
    const canLeave = useAnnotationStore.getState().requestLeave('library')
    if (canLeave) onClose()
  }, [onClose])

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

        useAppStore.getState().setToc(parsed.map((ch, i) => ({
          label: ch.title,
          href: `chapter-${i}`,
          spineIndex: i
        })))

        if (parsed.length > 0) {
          useAppStore.getState().setAiContext({
            chapter: parsed[0].title,
            content: parsed[0].content.slice(0, 5000)
          })
        }

        setLoading(false)
      } catch {
        if (cancelled) return
        setError('Failed to load file.')
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [filePath])

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

  useEffect(() => {
    if (!contentRef.current || loading) return
    const el = contentRef.current
    let ticking = false

    const update = () => {
      const total = el.scrollHeight - el.clientHeight
      const pct = total > 0 ? Math.round((el.scrollTop / total) * 100) : 0
      onProgress?.(pct)

      let chapterIdx = 0
      const sections = el.querySelectorAll('[data-chapter]')
      const containerRect = el.getBoundingClientRect()
      const viewTop = containerRect.top + containerRect.height * 0.2
      for (const sec of sections) {
        const rect = sec.getBoundingClientRect()
        if (rect.top <= viewTop) chapterIdx = Number((sec as HTMLElement).dataset.chapter) || 0
        else break
      }
      const ch = chapters[chapterIdx]
      if (ch) {
        useAppStore.getState().setAiContext({
          chapter: ch.title,
          content: ch.content.slice(0, 5000)
        })
      }
    }

    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(() => { update(); ticking = false }) }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [loading, chapters, onProgress])

  const navigateToPercent = useAppStore((s) => s.navigateToPercent)
  const setNavigateToPercent = useAppStore((s) => s.setNavigateToPercent)
  useEffect(() => {
    if (navigateToPercent === null || !contentRef.current) return
    const el = contentRef.current
    const total = el.scrollHeight - el.clientHeight
    if (total > 0) el.scrollTop = Math.round((total * navigateToPercent) / 100)
    setNavigateToPercent(null)
  }, [navigateToPercent, setNavigateToPercent])

  const navigateToSpineIndex = useAppStore((s) => s.navigateToSpineIndex)
  const setNavigateToSpineIndex = useAppStore((s) => s.setNavigateToSpineIndex)
  useEffect(() => {
    if (navigateToSpineIndex === null || !contentRef.current) return
    const el = contentRef.current.querySelector(`[data-chapter="${navigateToSpineIndex}"]`) as HTMLElement | null
    if (el) {
      const container = contentRef.current
      const containerRect = container.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      container.scrollTop += elRect.top - containerRect.top - 80
    }
    setNavigateToSpineIndex(null)
  }, [navigateToSpineIndex, setNavigateToSpineIndex])

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
        <BackToLibraryButton onClick={requestClose} />
        <AnnotationToolbar />
        <div className="flex items-center gap-2 shrink-0">
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
      </div>

      <div className="relative flex-1 min-h-0">
        <div ref={setContentRef} className="reader-scroll scrollbar-thin absolute inset-0">
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
                <section key={i} data-chapter={i} data-href={`chapter-${i}`} className="mb-8">
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

        {!loading && !error && (
          <>
            <HighlightLayer scrollRef={contentRef} />
            <AnnotationOverlay scrollRef={contentRef} />
            <MarkSelectionHandler scrollRef={contentRef} />
          </>
        )}
      </div>
    </div>
  )
}
