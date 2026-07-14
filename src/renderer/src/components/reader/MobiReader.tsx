import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { parseMobi, type MobiChapter } from '../../lib/mobiParser'
import { cleanBookTitle } from '../../lib/bookTitle'
import { useAppStore } from '../../stores/appStore'
import { useReaderFontSize } from '../../lib/useReaderFontSize'
import ReaderThemeBar from './ReaderThemeBar'
import BackToLibraryButton from './BackToLibraryButton'
import { useAnnotationStore } from '../../stores/annotationStore'
import { annotationFormatForBook } from '../../lib/annotationTypes'
import { shouldIgnoreReaderShortcut } from '../../lib/readerShortcuts'
import { readScrollPercent, restoreScrollPercent } from '../../lib/scrollProgress'
import { stripHtmlToPlain } from '../../lib/bookSearch'
import { useSearchHitNavigation } from '../../lib/useSearchHitNavigation'
import AnnotationToolbar from './annotation/AnnotationToolbar'
import AnnotationOverlay from './annotation/AnnotationOverlay'
import HighlightLayer from './annotation/HighlightLayer'
import MarkSelectionHandler from './annotation/MarkSelectionHandler'

interface Props {
  filePath: string
  onClose: () => void
  onProgress?: (chapterIndex: number, chapterCount: number, percent: number) => void
  onTocReady?: (toc: { label: string; href: string; spineIndex: number }[]) => void
  initialProgress?: number
}

export default function MobiReader({ filePath, onClose, onProgress, onTocReady, initialProgress }: Props) {
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { fontSize, increaseFont, decreaseFont } = useReaderFontSize()
  const [chapters, setChapters] = useState<MobiChapter[]>([])
  const contentRef = useRef<HTMLDivElement | null>(null)
  const hasRestoredRef = useRef(false)
  const restoringRef = useRef(false)
  const currentBook = useAppStore((s) => s.currentBook)

  // Callback ref: stores DOM el in Zustand for TocPanel
  const setContentRef = useCallback((el: HTMLDivElement | null) => {
    contentRef.current = el
    useAppStore.getState()._setReaderEl(el)
  }, [])

  useSearchHitNavigation(contentRef)

  // Cleanup TOC + search on unmount
  useEffect(() => {
    return () => {
      useAppStore.getState().setToc([])
      useAppStore.getState().setSearchChapters([])
    }
  }, [])

  // Load annotations (MOBI / AZW / AZW3 share format "mobi")
  useEffect(() => {
    if (!currentBook?.id) return
    const fmt = annotationFormatForBook(currentBook.format)
    void useAnnotationStore.getState().loadForBook(currentBook.id, fmt)
    return () => { useAnnotationStore.getState().reset() }
  }, [currentBook?.id, currentBook?.format])

  const flushProgress = useCallback(() => {
    const el = contentRef.current
    if (!el || chapters.length === 0) return
    const pct = readScrollPercent(el)
    let currentIdx = 0
    const sections = el.querySelectorAll('[data-chapter]')
    const containerRect = el.getBoundingClientRect()
    const viewTop = containerRect.top + containerRect.height * 0.2
    for (const sec of Array.from(sections)) {
      const rect = sec.getBoundingClientRect()
      if (rect.top <= viewTop) currentIdx = Number((sec as HTMLElement).dataset.chapter) || 0
      else break
    }
    onProgress?.(currentIdx, chapters.length, pct)
  }, [chapters, onProgress])

  const flushProgressRef = useRef(flushProgress)
  flushProgressRef.current = flushProgress

  const requestClose = useCallback(() => {
    flushProgress()
    const canLeave = useAnnotationStore.getState().requestLeave('library')
    if (canLeave) onClose()
  }, [onClose, flushProgress])

  // Load MOBI/AZW3 via foliate-js
  useEffect(() => {
    let cancelled = false
    let destroyBook: (() => void) | undefined
    setLoading(true)
    setError(null)
    hasRestoredRef.current = false

    const load = async () => {
      try {
        const base64 = await window.scrollAPI.readFile(filePath)
        if (cancelled) return

        const content = await parseMobi(base64)
        if (cancelled) {
          content.destroy()
          return
        }
        destroyBook = content.destroy

        const displayTitle = cleanBookTitle(content.metadata.title)
        const displayAuthor = content.metadata.author

        setTitle(displayTitle)
        setAuthor(displayAuthor)
        setChapters(content.chapters)

        // Sync cleaned metadata + cover into library / top bar / TOC header
        {
          const st = useAppStore.getState()
          const book = st.currentBook
          if (book) {
            const patch: Partial<typeof book> = {}
            if (displayTitle && displayTitle !== book.title) patch.title = displayTitle
            if (displayAuthor && displayAuthor !== 'Unknown Author' && displayAuthor !== book.author) {
              patch.author = displayAuthor
            }
            if (content.coverUrl && !book.coverUrl) {
              const ref = await window.scrollAPI.saveCover(book.id, content.coverUrl)
              if (ref) patch.coverUrl = ref
            }
            if (Object.keys(patch).length > 0) {
              const next = { ...book, ...patch }
              useAppStore.setState({
                currentBook: next,
                books: st.books.map((b) => (b.id === book.id ? next : b))
              })
            }
          }
        }

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
        setError('Failed to load MOBI: ' + msg)
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
      destroyBook?.()
    }
  }, [filePath])

  useEffect(() => {
    if (chapters.length === 0) return
    useAppStore.getState().setSearchChapters(
      chapters.map((ch, i) => ({
        chapterIndex: i,
        title: ch.title,
        plainText: stripHtmlToPlain(ch.html)
      }))
    )
  }, [chapters])

  // Restore reading position
  useEffect(() => {
    if (chapters.length === 0 || hasRestoredRef.current) return

    const pct = initialProgress && initialProgress > 0 && initialProgress < 100 ? initialProgress : null
    if (!pct) { hasRestoredRef.current = true; return }

    hasRestoredRef.current = true
    restoringRef.current = true
    const stop = restoreScrollPercent(() => contentRef.current, pct)
    const doneTimer = setTimeout(() => { restoringRef.current = false }, 4200)
    return () => { stop(); clearTimeout(doneTimer); restoringRef.current = false }
  }, [chapters, initialProgress])

  useEffect(() => {
    return () => { flushProgressRef.current() }
  }, [])

  // Scroll progress tracking
  useEffect(() => {
    if (!contentRef.current || loading) return
    const el = contentRef.current
    let ticking = false

    const update = () => {
      if (restoringRef.current) return
      const pct = readScrollPercent(el)

      let currentIdx = 0
      const sections = el.querySelectorAll('[data-chapter]')
      const containerRect = el.getBoundingClientRect()
      const viewTop = containerRect.top + containerRect.height * 0.2
      for (const sec of Array.from(sections)) {
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

  // Bookmark navigation
  const navigateToPercent = useAppStore((s) => s.navigateToPercent)
  const setNavigateToPercent = useAppStore((s) => s.setNavigateToPercent)
  useEffect(() => {
    if (navigateToPercent === null || !contentRef.current) return
    restoringRef.current = true
    const stop = restoreScrollPercent(() => contentRef.current, navigateToPercent, { maxMs: 1500 })
    setNavigateToPercent(null)
    const t = setTimeout(() => { restoringRef.current = false }, 1600)
    return () => { stop(); clearTimeout(t); restoringRef.current = false }
  }, [navigateToPercent, setNavigateToPercent])

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (shouldIgnoreReaderShortcut(e)) return
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
    <div className="reader-frame">
      <div className="reader-toolbar">
        <div className="flex items-center gap-2 min-w-0 shrink">
          <BackToLibraryButton onClick={requestClose} />
        </div>
        <AnnotationToolbar />
        <div className="flex items-center gap-2 shrink-0">
          <ReaderThemeBar />
          <div className="flex items-center gap-3">
            <button onClick={decreaseFont}
              className="p-1 chrome-muted hover:opacity-80 transition-colors">
              <ZoomOut size={16} />
            </button>
            <span className="text-xs chrome-muted tabular-nums w-10 text-center">{fontSize}%</span>
            <button onClick={increaseFont}
              className="p-1 chrome-muted hover:opacity-80 transition-colors">
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
              <div className="text-center text-red-500 px-4">
                <p className="text-sm">Failed to load MOBI</p>
                <p className="text-xs mt-1 text-red-400">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && (
            <div className="max-w-4xl mx-auto px-8 py-6 reader-content" style={{ fontSize: `${fontSize}%` }}>
              <h1 className="text-2xl font-bold mb-2 text-center">{title}</h1>
              {author && author !== 'Unknown Author' && (
                <p className="text-sm text-center chrome-muted mb-8">{author}</p>
              )}
              <div className={author && author !== 'Unknown Author' ? '' : 'mt-6'}>
                {chapterElements}
              </div>
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
