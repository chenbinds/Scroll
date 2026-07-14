import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { parseEpub, type EpubContent, type TocItem } from '../../lib/epubParser'
import { cleanBookTitle } from '../../lib/bookTitle'
import { useAppStore } from '../../stores/appStore'
import { useReaderFontSize } from '../../lib/useReaderFontSize'
import ReaderThemeBar from './ReaderThemeBar'
import BackToLibraryButton from './BackToLibraryButton'
import AnnotationToolbar from './annotation/AnnotationToolbar'
import AnnotationOverlay from './annotation/AnnotationOverlay'
import HighlightLayer from './annotation/HighlightLayer'
import MarkSelectionHandler from './annotation/MarkSelectionHandler'
import { useAnnotationStore } from '../../stores/annotationStore'
import { annotationFormatForBook } from '../../lib/annotationTypes'
import { shouldIgnoreReaderShortcut } from '../../lib/readerShortcuts'
import { readScrollPercent, restoreScrollPercent } from '../../lib/scrollProgress'

interface Props {
  filePath: string
  onClose: () => void
  onProgress?: (chapterIndex: number, chapterCount: number, percent: number) => void
  onTocReady?: (toc: TocItem[]) => void
  initialChapterIndex?: number
  initialProgress?: number
}

export type { TocItem }

export default function EpubReader({ filePath, onClose, onProgress, onTocReady, initialChapterIndex, initialProgress }: Props) {
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { fontSize, increaseFont, decreaseFont } = useReaderFontSize()
  const [epubContent, setEpubContent] = useState<EpubContent | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const hasRestoredRef = useRef(false)
  const restoringRef = useRef(false)
  const currentBook = useAppStore((s) => s.currentBook)

  // Callback ref: stores the DOM element in Zustand for TocPanel to use
  // Called during React's commit phase — before paint, no timing hole
  const setContentRef = useCallback((el: HTMLDivElement | null) => {
    contentRef.current = el
    useAppStore.getState()._setReaderEl(el)
  }, [])

  // Cleanup TOC on unmount
  useEffect(() => {
    return () => { useAppStore.getState().setToc([]) }
  }, [])

  // Load annotations for current book
  useEffect(() => {
    if (!currentBook?.id) return
    void useAnnotationStore.getState().loadForBook(
      currentBook.id,
      annotationFormatForBook(currentBook.format)
    )
    return () => { useAnnotationStore.getState().reset() }
  }, [currentBook?.id, currentBook?.format])

  const flushProgress = useCallback(() => {
    const el = contentRef.current
    if (!el || !epubContent) return
    const pct = readScrollPercent(el)
    let currentIdx = 0
    const chapters = el.querySelectorAll('[data-chapter]')
    const containerRect = el.getBoundingClientRect()
    const viewTop = containerRect.top + containerRect.height * 0.2
    for (const ch of chapters) {
      const rect = ch.getBoundingClientRect()
      if (rect.top <= viewTop) currentIdx = Number((ch as HTMLElement).dataset.chapter) || 0
      else break
    }
    onProgress?.(currentIdx, epubContent.spine.length, pct)
  }, [epubContent, onProgress])

  const flushProgressRef = useRef(flushProgress)
  flushProgressRef.current = flushProgress

  const requestClose = useCallback(() => {
    flushProgress()
    const canLeave = useAnnotationStore.getState().requestLeave('library')
    if (canLeave) onClose()
  }, [onClose, flushProgress])

  // Load EPUB
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    hasRestoredRef.current = false

    const load = async () => {
      try {
        const base64 = await window.scrollAPI.readFile(filePath)
        if (cancelled) return

        const content = await parseEpub(base64)
        if (cancelled) return

        setEpubContent(content)
        const displayTitle = cleanBookTitle(content.metadata.title)
        setTitle(displayTitle)
        setAuthor(content.metadata.author)
        onTocReady?.(content.toc)

        {
          const st = useAppStore.getState()
          const book = st.currentBook
          if (book) {
            const patch: Partial<typeof book> = {}
            if (displayTitle && displayTitle !== book.title) patch.title = displayTitle
            if (content.metadata.author && content.metadata.author !== 'Unknown Author' && content.metadata.author !== book.author) {
              patch.author = content.metadata.author
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

        if (content.spine.length > 0) {
          const firstContent = content.files.get(content.spine[0].href)
          useAppStore.getState().setAiContext({
            chapter: content.toc[0]?.label || '',
            content: firstContent?.slice(0, 5000) || ''
          })
        }
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        setError('Failed to load EPUB: ' + (err instanceof Error ? err.message : String(err)))
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [filePath])

  // Restore reading position (high precision + re-apply while layout settles)
  useEffect(() => {
    if (!epubContent || hasRestoredRef.current) return

    const pct = initialProgress && initialProgress > 0 && initialProgress < 100 ? initialProgress : null
    if (!pct && !(initialChapterIndex && initialChapterIndex > 0)) {
      hasRestoredRef.current = true
      return
    }

    hasRestoredRef.current = true
    restoringRef.current = true

    if (pct) {
      const stop = restoreScrollPercent(() => contentRef.current, pct)
      const doneTimer = setTimeout(() => { restoringRef.current = false }, 4200)
      return () => { stop(); clearTimeout(doneTimer); restoringRef.current = false }
    }

    // Chapter-based fallback only
    let cancelled = false
    const tryChapter = (attempts: number) => {
      if (cancelled) return
      const container = contentRef.current
      if (!container) {
        if (attempts < 10) setTimeout(() => tryChapter(attempts + 1), 200)
        else restoringRef.current = false
        return
      }
      const el = container.querySelector(`[data-chapter="${initialChapterIndex}"]`) as HTMLElement | null
      if (!el) {
        if (attempts < 10) setTimeout(() => tryChapter(attempts + 1), 200)
        else restoringRef.current = false
        return
      }
      const containerRect = container.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      container.scrollTop = container.scrollTop + (elRect.top - containerRect.top) - 80
      restoringRef.current = false
    }
    setTimeout(() => tryChapter(0), 100)
    return () => { cancelled = true; restoringRef.current = false }
  }, [epubContent, initialChapterIndex, initialProgress])

  // Flush only on true unmount — do NOT depend on flushProgress identity
  // (parent passes a new onProgress every render; cleanup would infinite-loop)
  useEffect(() => {
    return () => { flushProgressRef.current() }
  }, [])

  // Scroll progress tracking
  useEffect(() => {
    if (!contentRef.current || !epubContent) return
    const el = contentRef.current
    let ticking = false

    const update = () => {
      if (restoringRef.current) return
      const pct = readScrollPercent(el)

      let currentIdx = 0
      const chapters = el.querySelectorAll('[data-chapter]')
      const containerRect = el.getBoundingClientRect()
      const viewTop = containerRect.top + containerRect.height * 0.2
      for (const ch of chapters) {
        const rect = ch.getBoundingClientRect()
        if (rect.top <= viewTop) currentIdx = Number((ch as HTMLElement).dataset.chapter) || 0
        else break
      }
      onProgress?.(currentIdx, epubContent.spine.length, pct)
    }

    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(() => { update(); ticking = false }) }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [epubContent, onProgress])

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
    if (!epubContent) return null
    return epubContent.spine.map((item, i) => {
      const html = epubContent.files.get(item.href)
      return (
        <section key={i} data-href={item.href} data-chapter={i} className="mb-8">
          {html ? (
            <div dangerouslySetInnerHTML={{ __html: extractBody(html) }} />
          ) : (
            <div className="text-sm text-gray-400 italic py-4">[Content unavailable]</div>
          )}
        </section>
      )
    })
  }, [epubContent])

  return (
    <div className="reader-frame">
      {/* Toolbar */}
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

      {/* Content + viewport annotation canvas (siblings — EPUB DOM untouched) */}
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
                <p className="text-sm">Failed to load EPUB</p>
                <p className="text-xs mt-1 text-red-400">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && chapterElements && (
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

function extractBody(html: string): string {
  let content = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<meta[^>]*>/gi, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<html[^>]*>/gi, '')
    .replace(/<\/html>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')

  const removeUnresolved = (tag: string) => {
    if (/src=["']data:image\//i.test(tag)) return tag
    if (/href=["']data:image\//i.test(tag)) return tag
    if (/xlink:href=["']data:image\//i.test(tag)) return tag
    if (!/<(img|image)\b/i.test(tag) && !/type=["']image/i.test(tag)) return tag
    return ''
  }
  content = content.replace(/<(img|image|input)[^>]*>/gi, (tag) => removeUnresolved(tag))
  content = content.replace(/<image[^>]*\/>/gi, (tag) => removeUnresolved(tag))
  content = content.replace(/url\(["']?(?!data:)[^)"']+["']?\)/gi, 'none')

  const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  if (bodyMatch) content = bodyMatch[1]
  return content
}
