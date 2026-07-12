import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { parseEpub, type EpubContent, type TocItem } from '../../lib/epubParser'
import { useAppStore } from '../../stores/appStore'
import ReaderThemeBar from './ReaderThemeBar'
import { useI18n } from '../../lib/i18n'

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
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fontSize, setFontSize] = useState(100)
  const [epubContent, setEpubContent] = useState<EpubContent | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const hasRestoredRef = useRef(false)

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
        setTitle(content.metadata.title)
        setAuthor(content.metadata.author)
        onTocReady?.(content.toc)

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

  // Restore reading position
  useEffect(() => {
    if (!epubContent || hasRestoredRef.current) return

    // Determine the target scroll position
    const pct = initialProgress && initialProgress > 0 && initialProgress < 100 ? initialProgress : null
    if (!initialChapterIndex && !pct) { hasRestoredRef.current = true; return }

    hasRestoredRef.current = true

    const tryScroll = (attempts: number) => {
      const container = contentRef.current
      if (!container) { if (attempts < 10) setTimeout(() => tryScroll(attempts + 1), 200); return }

      let targetTop: number | null = null

      if (pct) {
        // Percentage-based: accurate within ± several pages
        const total = container.scrollHeight - container.clientHeight
        if (total > 0) targetTop = Math.round((total * pct) / 100)
      }

      if (targetTop == null && initialChapterIndex && initialChapterIndex > 0) {
        // Chapter-based fallback
        const el = container.querySelector(`[data-chapter="${initialChapterIndex}"]`) as HTMLElement | null
        if (!el) { if (attempts < 10) setTimeout(() => tryScroll(attempts + 1), 200); return }
        const containerRect = container.getBoundingClientRect()
        const elRect = el.getBoundingClientRect()
        targetTop = container.scrollTop + (elRect.top - containerRect.top) - 80
      }

      if (targetTop != null) {
        container.scrollTo({ top: targetTop, behavior: 'instant' })
      }
    }
    setTimeout(() => tryScroll(0), 100)
  }, [epubContent, initialChapterIndex, initialProgress])

  // Scroll progress tracking
  useEffect(() => {
    if (!contentRef.current || !epubContent) return
    const el = contentRef.current
    let ticking = false

    const update = () => {
      const total = el.scrollHeight - el.clientHeight
      const pct = total > 0 ? Math.round((el.scrollTop / total) * 100) : 0

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
    <div className="h-full flex flex-col bg-white dark:bg-gray-950">
      {/* Toolbar */}
      <div className="h-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800
                      flex items-center justify-between px-3 no-select flex-shrink-0">
        <button onClick={onClose}
          className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
          ← {t('app.backToLibrary')}
        </button>
        <span className="text-xs text-gray-400 truncate max-w-[300px]">{title}</span>
          <ReaderThemeBar />
          
        <div className="flex items-center gap-3">
          <button onClick={decreaseFont}
            className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
            <ZoomOut size={16} />
          </button>
          <span className="text-xs text-gray-400 tabular-nums w-10 text-center">{fontSize}%</span>
          <button onClick={increaseFont}
            className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
            <ZoomIn size={16} />
          </button>
        </div>
      </div>

      {/* Content — full render, callback ref stores DOM el for TocPanel */}
      <div ref={setContentRef} className="flex-1 overflow-auto scrollbar-thin">
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
