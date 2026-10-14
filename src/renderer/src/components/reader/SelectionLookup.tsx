import { useCallback, useEffect, useRef, useState } from 'react'
import { BookOpen, Check, Loader2, X } from 'lucide-react'
import { useAnnotationStore } from '../../stores/annotationStore'
import { useAppStore } from '../../stores/appStore'
import { useI18n } from '../../lib/i18n'
import { explain } from '../../lib/aiService'
import { selectionToNormRects, offsetsFromRange, resolveHighlightRects } from '../../lib/highlightRects'
import type { AnnotationAnchor, AnnotationHighlight, NormRect } from '../../lib/annotationTypes'
import { DEFAULT_MARK } from '../../lib/annotationTypes'
interface Props {
  scrollRef: React.RefObject<HTMLDivElement | null>
}

const MAX_TERM = 2000
const NOTE_MAX_LENGTH = 2000
/** 查义已关闭思考。2000 token 对应笔记上限的 2000 字。 */
const LOOKUP_MAX_TOKENS = NOTE_MAX_LENGTH
const PANEL_WIDTH = 360

interface SelState {
  text: string
  left: number
  top: number
  rects: NormRect[]
  textStart?: number
  textEnd?: number
  anchor: AnnotationAnchor
}

function findChapterAnchor(
  scrollEl: HTMLElement,
  clientX: number,
  clientY: number
): AnnotationAnchor {
  const stack = document.elementsFromPoint(clientX, clientY)
  for (const node of stack) {
    if (!(node instanceof HTMLElement)) continue
    if (node.tagName === 'CANVAS') continue
    let el: HTMLElement | null = node
    while (el && el !== scrollEl) {
      if (el.dataset.chapter != null) {
        return {
          type: 'document',
          chapterHref: el.dataset.href,
          chapterIndex: Number(el.dataset.chapter)
        }
      }
      el = el.parentElement
    }
  }
  return { type: 'document' }
}

function findOverlappingHighlight(
  newRects: NormRect[],
  existing: AnnotationHighlight[],
  scrollEl: HTMLElement
): AnnotationHighlight | null {
  const EPS = 1e-8
  for (let i = existing.length - 1; i >= 0; i--) {
    const hl = existing[i]
    const rects = resolveHighlightRects(scrollEl, hl)
    for (const nr of newRects) {
      for (const er of rects) {
        const ax2 = nr[0] + nr[2]
        const ay2 = nr[1] + nr[3]
        const bx2 = er[0] + er[2]
        const by2 = er[1] + er[3]
        const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(nr[0], er[0]))
        const iy = Math.max(0, Math.min(ay2, by2) - Math.max(nr[1], er[1]))
        if (ix * iy > EPS) return hl
      }
    }
  }
  return null
}

export default function SelectionLookup({ scrollRef }: Props) {
  const { t } = useI18n()
  const activeTool = useAnnotationStore((s) => s.activeTool)
  const aiConfig = useAppStore((s) => s.aiConfig)

  const [sel, setSel] = useState<SelState | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [savedHint, setSavedHint] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const seqRef = useRef(0)

  const clear = useCallback(() => {
    setSel(null)
    setOpen(false)
    setLoading(false)
    setResult('')
    setError(null)
    setSavedHint(false)
  }, [])

  useEffect(() => {
    if (activeTool !== 'none') clear()
  }, [activeTool, clear])

  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return

    const onMouseUp = () => {
      if (useAnnotationStore.getState().activeTool !== 'none') return
      requestAnimationFrame(() => {
        const selection = window.getSelection()
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
          if (!open && !loading) setSel(null)
          return
        }
        const range = selection.getRangeAt(0)
        if (!scrollEl.contains(range.commonAncestorContainer)) return
        const text = selection.toString().replace(/\s+/g, ' ').trim()
        if (!text || text.length > MAX_TERM) {
          if (!open) setSel(null)
          return
        }
        const rect = range.getBoundingClientRect()
        const left = Math.min(
          window.innerWidth - 88,
          Math.max(8, rect.left + rect.width / 2 - 36)
        )
        const top = Math.max(8, rect.top - 36)
        const rects = selectionToNormRects(scrollEl, range)
        const offsets = offsetsFromRange(scrollEl, range)
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        setSel({
          text,
          left,
          top,
          rects,
          textStart: offsets?.start,
          textEnd: offsets?.end,
          anchor: findChapterAnchor(scrollEl, cx, cy)
        })
        setOpen(false)
        setResult('')
        setError(null)
        setSavedHint(false)
      })
    }

    const onScroll = () => {
      if (!open && !loading) setSel(null)
    }

    scrollEl.addEventListener('mouseup', onMouseUp)
    scrollEl.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      scrollEl.removeEventListener('mouseup', onMouseUp)
      scrollEl.removeEventListener('scroll', onScroll)
    }
  }, [scrollRef, open, loading])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return
      clear()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clear()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, clear])

  const runLookup = async () => {
    if (!sel) return
    const configured = !!(aiConfig.baseUrl && aiConfig.apiKey && aiConfig.model)
    if (!configured) {
      setOpen(true)
      setError(t('lookup.notConfigured'))
      return
    }

    const term = sel.text
    const chapter = useAppStore.getState().aiContext.content || ''
    setOpen(true)
    setLoading(true)
    setResult('')
    setError(null)
    setSavedHint(false)
    const seq = ++seqRef.current

    try {
      const answer = await explain(term, chapter, {
        baseUrl: aiConfig.baseUrl,
        apiKey: aiConfig.apiKey,
        model: aiConfig.model,
        maxTokens: LOOKUP_MAX_TOKENS
      })
      if (seq !== seqRef.current) return
      const text = answer.trim()
      if (!text) {
        setError(t('lookup.empty'))
        return
      }
      setResult(text.slice(0, NOTE_MAX_LENGTH))
    } catch (e) {
      if (seq !== seqRef.current) return
      setError(e instanceof Error ? e.message : t('lookup.failed'))
    } finally {
      if (seq === seqRef.current) setLoading(false)
    }
  }

  const handleSave = () => {
    if (!sel || !result.trim()) return
    const scrollEl = scrollRef.current
    const noteText = result.trim().slice(0, NOTE_MAX_LENGTH)
    const store = useAnnotationStore.getState()
    const { markColor, markOpacity, highlights, addHighlight, updateHighlight } = store

    if (scrollEl && sel.rects.length > 0) {
      const hit = findOverlappingHighlight(sel.rects, highlights, scrollEl)
      if (hit) {
        updateHighlight(hit.id, { note: noteText })
        setSavedHint(true)
        window.setTimeout(() => clear(), 600)
        return
      }
    }

    const hl: AnnotationHighlight = {
      id: crypto.randomUUID(),
      tool: 'mark',
      color: markColor || DEFAULT_MARK.color,
      opacity: markOpacity || DEFAULT_MARK.opacity,
      rects: sel.rects,
      text: sel.text.slice(0, 500) || undefined,
      textStart: sel.textStart,
      textEnd: sel.textEnd,
      note: noteText,
      anchor: sel.anchor,
      createdAt: Date.now()
    }
    addHighlight(hl)
    setSavedHint(true)
    window.setTimeout(() => clear(), 600)
  }

  if (!sel) return null

  const panelLeft = Math.min(sel.left, window.innerWidth - PANEL_WIDTH - 12)
  const panelTop = Math.min(sel.top + 28, window.innerHeight - 160)

  return (
    <>
      {!open && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void runLookup()}
          className="fixed z-[55] flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-md shadow
                     chrome-surface-raised border border-[var(--reader-border)]
                     hover:opacity-90"
          style={{ left: sel.left, top: sel.top }}
        >
          <BookOpen size={14} />
          {t('lookup.action')}
        </button>
      )}

      {open && (
        <div
          ref={panelRef}
          className="fixed z-[56] flex flex-col w-[360px] min-w-[260px] min-h-[200px]
                     max-w-[min(520px,92vw)] max-h-[min(520px,75vh)]
                     overflow-auto resize rounded-lg shadow-lg
                     chrome-surface-raised border border-[var(--reader-border)] p-3"
          style={{ left: panelLeft, top: panelTop }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2 mb-2 shrink-0">
            <p className="text-sm font-medium line-clamp-2 flex-1 leading-snug">「{sel.text}」</p>
            <button
              type="button"
              onClick={clear}
              className="p-0.5 chrome-muted shrink-0"
              aria-label={t('annotation.close')}
            >
              <X size={14} />
            </button>
          </div>

          {loading && (
            <p className="text-sm chrome-muted flex items-center gap-1.5 py-3">
              <Loader2 size={14} className="animate-spin" />
              {t('lookup.loading')}
            </p>
          )}

          {error && (
            <p className="text-sm text-red-500 whitespace-pre-wrap">{error}</p>
          )}

          {!loading && !error && (
            <>
              <textarea
                value={result}
                onChange={(e) => setResult(e.target.value.slice(0, NOTE_MAX_LENGTH))}
                maxLength={NOTE_MAX_LENGTH}
                rows={6}
                placeholder={t('lookup.resultPlaceholder')}
                className="flex-1 min-h-[140px] w-full resize-none text-sm leading-relaxed rounded
                           border border-[var(--reader-border)] bg-[var(--reader-bg)]
                           px-2.5 py-2 outline-none focus:ring-1 focus:ring-scroll-400
                           overflow-y-auto"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') clear()
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave()
                }}
              />
              <div className="flex items-center justify-between gap-2 mt-2 shrink-0">
                <span className="text-xs chrome-muted tabular-nums">
                  {savedHint ? t('lookup.saved') : `${result.length}/${NOTE_MAX_LENGTH}`}
                </span>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!result.trim() || savedHint}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-sm rounded
                             chrome-muted hover:text-scroll-600 hover:bg-scroll-50
                             dark:hover:bg-scroll-900/30 transition-colors
                             disabled:opacity-40 disabled:cursor-not-allowed"
                  title={t('lookup.save')}
                >
                  <Check size={16} />
                  {t('lookup.save')}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
