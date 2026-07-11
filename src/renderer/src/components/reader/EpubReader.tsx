import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { parseEpub, type EpubContent, type TocItem } from '../../lib/epubParser'
import { useAppStore } from '../../stores/appStore'
import { useI18n } from '../../lib/i18n'

interface Props {
  filePath: string
  onClose: () => void
  onProgress?: (chapterIndex: number, chapterCount: number, percent: number) => void
  onTocReady?: (toc: TocItem[]) => void
  initialChapterIndex?: number
}

export type { TocItem }

export default function EpubReader({ filePath, onClose, onProgress, onTocReady, initialChapterIndex }: Props) {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fontSize, setFontSize] = useState(100)
  const [epubContent, setEpubContent] = useState<EpubContent | null>(null)
  const [renderedChapters, setRenderedChapters] = useState<Set<number>>(new Set())
  const contentRef = useRef<HTMLDivElement>(null)
  const hasRestoredRef = useRef(false)

  // ---- Direct-call nav function (registered in store, called by TocPanel) ----
  // Uses epubContent from closure with [epubContent] dep — always current
  const navToChapter = useCallback((targetIndex: number) => {
    // epubContent is captured via [epubContent] dep — always current when called
    if (!epubContent || !contentRef.current) return

    // Render target + broad surrounding range
    setRenderedChapters((prev) => {
      const next = new Set(prev)
      let changed = false
      for (let i = Math.max(0, targetIndex - 8); i <= Math.min(epubContent.spine.length - 1, targetIndex + 8); i++) {
        if (!next.has(i)) { next.add(i); changed = true }
      }
      return changed ? next : prev
    })

    // Wait for React to flush, then scroll
    let attempts = 0
    const tryScroll = () => {
      const el = contentRef.current?.querySelector(`[data-chapter="${targetIndex}"]`) as HTMLElement | null
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        attempts++
        if (attempts < 30) setTimeout(tryScroll, 60)
      }
    }
    requestAnimationFrame(() => setTimeout(tryScroll, 40))
  }, [epubContent])

  // Register nav function in store so TocPanel can call it directly
  useEffect(() => {
    if (epubContent) {
      useAppStore.getState()._setNavFn(navToChapter)
    }
    return () => { useAppStore.getState()._setNavFn(null) }
  }, [navToChapter, epubContent])

  // Load EPUB
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    hasRestoredRef.current = false
    setRenderedChapters(new Set())

    const startIdx = initialChapterIndex ?? 0

    const load = async () => {
      try {
        const base64 = await window.scrollAPI.readFile(filePath)
        if (cancelled) return

        const content = await parseEpub(base64)
        if (cancelled) return

        setEpubContent(content)
        setTitle(content.metadata.title)
        onTocReady?.(content.toc)

        // Render initial chapters
        const initialSet = new Set<number>()
        for (let i = Math.max(0, startIdx - 5); i <= Math.min(content.spine.length - 1, startIdx + 5); i++) {
          initialSet.add(i)
        }
        setRenderedChapters(initialSet)

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
        console.error('[EpubReader] Parse error:', err)
        setError('Failed to load EPUB: ' + (err instanceof Error ? err.message : String(err)))
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
      useAppStore.getState().setToc([])
    }
  }, [filePath])

  // Restore reading position
  useEffect(() => {
    if (!epubContent || !contentRef.current || hasRestoredRef.current) return
    if (!initialChapterIndex || initialChapterIndex <= 0) return

    hasRestoredRef.current = true
    let attempts = 0
    let timer: ReturnType<typeof setTimeout>

    const tryScroll = () => {
      const target = contentRef.current?.querySelector(`[data-chapter="${initialChapterIndex}"]`) as HTMLElement | null
      if (target) { target.scrollIntoView({ block: 'start' }); return }
      attempts++
      if (attempts < 30) timer = setTimeout(tryScroll, 200)
    }
    timer = setTimeout(tryScroll, 300)
    return () => clearTimeout(timer)
  }, [epubContent, initialChapterIndex])

  // Scroll progress tracking
  useEffect(() => {
    if (!contentRef.current || !epubContent) return
    const el = contentRef.current
    let ticking = false

    const updateProgress = () => {
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
      if (!ticking) { ticking = true; requestAnimationFrame(() => { updateProgress(); ticking = false }) }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [epubContent, onProgress])

  // ---- Scroll-based lazy activation (rAF only, NO time throttle) ----
  useEffect(() => {
    if (!contentRef.current || !epubContent) return
    const el = contentRef.current
    let ticking = false

    const check = () => {
      const buffer = el.clientHeight * 4 // 4x viewport — generous pre-load
      const top = el.scrollTop - buffer
      const bottom = el.scrollTop + el.clientHeight + buffer

      const children = el.querySelectorAll('[data-chapter]')
      const toActivate: number[] = []
      children.forEach((child) => {
        const i = Number((child as HTMLElement).dataset.chapter)
        if (Number.isNaN(i)) return
        const rect = child.getBoundingClientRect()
        const containerRect = el.getBoundingClientRect()
        const relTop = rect.top - containerRect.top
        const relBottom = rect.bottom - containerRect.top
        if (relBottom >= top && relTop <= bottom) toActivate.push(i)
      })

      if (toActivate.length > 0) {
        setRenderedChapters((prev) => {
          const next = new Set(prev)
          let changed = false
          for (const i of toActivate) { if (!next.has(i)) { next.add(i); changed = true } }
          return changed ? next : prev
        })
      }
      ticking = false
    }

    const onScroll = () => {
      if (!ticking) { requestAnimationFrame(check); ticking = true }
    }

    // Also run periodically as a fallback (handles fast scrolling, layout shifts)
    const interval = setInterval(check, 500)

    check()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => { el.removeEventListener('scroll', onScroll); clearInterval(interval) }
  }, [epubContent])

  // Font size
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

  // Chapter content nodes
  const chapterNodes = useMemo(() => {
    if (!epubContent) return null
    return epubContent.spine.map((item, i) => {
      const isRendered = renderedChapters.has(i)
      const html = epubContent.files.get(item.href)
      return (
        <section key={i} data-href={item.href} data-chapter={i} className="mb-8">
          {isRendered && html ? (
            <div dangerouslySetInnerHTML={{ __html: extractBody(html) }} />
          ) : (
            <ChapterPlaceholder html={html} />
          )}
        </section>
      )
    })
  }, [epubContent, renderedChapters])

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
    <div className="h-full flex flex-col bg-white dark:bg-gray-950">
      {/* Toolbar */}
      <div className="h-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800
                      flex items-center justify-between px-3 no-select flex-shrink-0">
        <button onClick={onClose}
          className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
          ← {t('app.backToLibrary')}
        </button>
        <span className="text-xs text-gray-400 truncate max-w-[300px]">{title}</span>
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

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-auto scrollbar-thin">
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

        {!loading && !error && chapterNodes && (
          <div className="max-w-4xl mx-auto px-8 py-6 reader-content" style={{ fontSize: `${fontSize}%` }}>
            <h1 className="text-2xl font-bold mb-8 text-center text-gray-900 dark:text-gray-100">{title}</h1>
            {chapterNodes}
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Pure placeholder — zero JS overhead ----
function ChapterPlaceholder({ html }: { html: string | undefined }) {
  const estimatedLines = html ? Math.ceil(html.length / 80) : 20
  const height = Math.max(estimatedLines * 28, 180)
  return (
    <div style={{ height: `${height}px` }}
         className="bg-gray-50 dark:bg-gray-800/30 rounded" />
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
