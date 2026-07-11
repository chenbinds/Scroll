import { useState, useEffect, useRef, useCallback } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { parseEpub, type EpubContent, type TocItem } from '../../lib/epubParser'
import { useAppStore } from '../../stores/appStore'
import { useI18n } from '../../lib/i18n'

interface Props {
  filePath: string
  onClose: () => void
  onProgress?: (chapter: string, progress: number) => void
  onTocReady?: (toc: TocItem[]) => void
  initialProgress?: number
}

export type { TocItem }

export default function EpubReader({ filePath, onClose, onProgress, onTocReady, initialProgress }: Props) {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fontSize, setFontSize] = useState(100)
  const [epubContent, setEpubContent] = useState<EpubContent | null>(null)
  const [renderedChapters, setRenderedChapters] = useState<Set<number>>(new Set([0]))
  const contentRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Load EPUB
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const load = async () => {
      try {
        const base64 = await window.scrollAPI.readFile(filePath)
        if (cancelled) return

        const content = await parseEpub(base64)
        if (cancelled) return

        setEpubContent(content)
        setTitle(content.metadata.title)
        onTocReady?.(content.toc)
        // Push first chapter to AI context
        if (content.spine.length > 0) {
          const firstHref = content.spine[0].href
          const firstContent = content.files.get(firstHref)
          useAppStore.getState().setAiContext({
            chapter: content.toc[0]?.label || '',
            content: firstContent?.slice(0, 5000) || ''
          })
        }
        setLoading(false)

        // Restore reading position
        if (initialProgress && initialProgress > 0 && initialProgress < 100 && contentRef.current) {
          setTimeout(() => {
            if (contentRef.current) {
              const total = contentRef.current.scrollHeight - contentRef.current.clientHeight
              contentRef.current.scrollTop = (total * initialProgress) / 100
            }
          }, 800)
        }
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        console.error('EPUB parse error:', msg)
        setError(msg)
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [filePath])

  // Scroll tracking for progress
  useEffect(() => {
    if (!contentRef.current || !epubContent) return
    const el = contentRef.current
    let ticking = false
    let lastUpdate = 0

    const updateProgress = () => {
      const total = el.scrollHeight - el.clientHeight
      const pct = total > 0 ? Math.round((el.scrollTop / total) * 100) : 0
      onProgress?.('', pct)
    }

    const onScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(() => {
          const now = Date.now()
          if (now - lastUpdate >= 500) {
            lastUpdate = now
            updateProgress()
          }
          ticking = false
        })
      }
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [epubContent, onProgress])

  // Font size
  const increaseFont = useCallback(() => setFontSize((s) => Math.min(s + 10, 200)), [])
  const decreaseFont = useCallback(() => setFontSize((s) => Math.max(s - 10, 60)), [])

  // TOC navigation with fuzzy href matching
  const { navigateToHref, setNavigateToHref } = useAppStore()
  useEffect(() => {
    if (navigateToHref && contentRef.current) {
      // Try exact match first
      let el = contentRef.current.querySelector(`[data-href="${CSS.escape(navigateToHref)}"]`)
      if (!el) {
        // Try match by filename (last path segment, ignoring fragment)
        const targetFile = navigateToHref.replace(/#.*$/, '').split('/').pop() || ''
        const sections = contentRef.current.querySelectorAll('[data-href]')
        for (const section of sections) {
          const href = section.getAttribute('data-href') || ''
          const hrefFile = href.replace(/#.*$/, '').split('/').pop() || ''
          if (hrefFile === targetFile) {
            el = section as HTMLElement
            break
          }
        }
      }
      if (!el) {
        // Try substring match
        const sections = contentRef.current.querySelectorAll('[data-href]')
        for (const section of sections) {
          const href = section.getAttribute('data-href') || ''
          if (href.includes(navigateToHref) || navigateToHref.includes(href)) {
            el = section as HTMLElement
            break
          }
        }
      }
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      setNavigateToHref(null)
    }
  }, [navigateToHref])

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

        {!loading && !error && epubContent && (
          <ChapterList
            epubContent={epubContent}
            fontSize={fontSize}
            title={title}
            renderedChapters={renderedChapters}
            setRenderedChapters={setRenderedChapters}
            observerRef={observerRef}
            contentRef={contentRef}
          />
        )}
      </div>
    </div>
  )
}

// ---- Virtual chapter list: only renders visible chapters ----

function ChapterList({
  epubContent, fontSize, title, renderedChapters, setRenderedChapters, observerRef, contentRef
}: {
  epubContent: EpubContent
  fontSize: number
  title: string
  renderedChapters: Set<number>
  setRenderedChapters: (s: Set<number>) => void
  observerRef: React.MutableRefObject<IntersectionObserver | null>
  contentRef: React.RefObject<HTMLDivElement | null>
}) {
  const activateChapter = useCallback((i: number) => {
    setRenderedChapters((prev) => {
      if (prev.has(i)) return prev
      return new Set([...prev, i])
    })
  }, [setRenderedChapters])

  // Set up scroll-based activation: activate chapters near viewport
  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    let ticking = false
    const check = () => {
      const buffer = el.clientHeight * 1.5 // 1.5x viewport height buffer
      const top = el.scrollTop - buffer
      const bottom = el.scrollTop + el.clientHeight + buffer

      const children = el.querySelectorAll('[data-chapter]')
      const toActivate = new Set<number>()
      children.forEach((child) => {
        const i = Number((child as HTMLElement).dataset.chapter)
        const rect = child.getBoundingClientRect()
        const containerRect = el.getBoundingClientRect()
        const relTop = rect.top - containerRect.top
        const relBottom = rect.bottom - containerRect.top
        if (relBottom >= top && relTop <= bottom) {
          toActivate.add(i)
        }
      })

      if (toActivate.size > 0) {
        setRenderedChapters((prev) => {
          const next = new Set(prev)
          let changed = false
          toActivate.forEach((i) => { if (!next.has(i)) { next.add(i); changed = true } })
          return changed ? next : prev
        })
      }

      ticking = false
    }

    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(check)
        ticking = true
      }
    }

    // Initial check
    check()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [epubContent, contentRef.current])

  return (
    <div className="max-w-4xl mx-auto px-8 py-6 reader-content" style={{ fontSize: `${fontSize}%` }}>
      <h1 className="text-2xl font-bold mb-8 text-center text-gray-900 dark:text-gray-100">
        {title}
      </h1>

      {epubContent.spine.map((item, i) => {
        const isRendered = renderedChapters.has(i)
        const html = epubContent.files.get(item.href)

        return (
          <section key={i} data-href={item.href} data-chapter={i} className="mb-8">
            {isRendered && html ? (
              <div dangerouslySetInnerHTML={{ __html: extractBody(html) }} />
            ) : (
              <ChapterPlaceholder html={html} activate={() => activateChapter(i)} />
            )}
          </section>
        )
      })}
    </div>
  )
}

function ChapterPlaceholder({ html, activate }: { html: string | undefined; activate: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          activate()
          obs.disconnect()
        }
      },
      { rootMargin: '400px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [activate])

  // Estimate height from HTML content length
  const estimatedLines = html ? Math.ceil(html.length / 80) : 20
  const height = Math.max(estimatedLines * 32, 200)

  return (
    <div ref={ref} style={{ minHeight: `${height}px` }}
         className="bg-gray-50 dark:bg-gray-800/30 rounded animate-pulse" />
  )
}

/** Extract body content from HTML, strip scripts/styles, remove unresolved images */
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

  // Remove images whose source is NOT a resolved data: URL
  // Catches <img>, <image> (SVG), and <input type="image">
  const removeUnresolved = (tag: string) => {
    // Keep if src/href points to resolved data URL
    if (/src=["']data:image\//i.test(tag)) return tag
    if (/href=["']data:image\//i.test(tag)) return tag
    // Keep if xlink:href points to resolved data URL
    if (/xlink:href=["']data:image\//i.test(tag)) return tag
    // Keep if it has NO external image reference at all (not an image tag)
    if (!/<(img|image)\b/i.test(tag) && !/type=["']image/i.test(tag)) return tag
    return '' // remove unresolved images
  }
  content = content.replace(/<(img|image|input)[^>]*>/gi, (tag) => removeUnresolved(tag))
  // Also handle SVG <image> with closing tag
  content = content.replace(/<image[^>]*\/>/gi, (tag) => removeUnresolved(tag))
  // Remove CSS url() references that aren't data: URIs
  content = content.replace(/url\(["']?(?!data:)[^)"']+["']?\)/gi, 'none')

  const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  if (bodyMatch) content = bodyMatch[1]

  return content
}
