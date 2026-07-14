import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { useAnnotationStore } from '../../../stores/annotationStore'
import { useAppStore } from '../../../stores/appStore'
import { useI18n } from '../../../lib/i18n'
import { selectionToNormRects } from './HighlightLayer'
import type { AnnotationHighlight, EpubAnchor, NormRect } from '../../../lib/annotationTypes'

interface Props {
  scrollRef: React.RefObject<HTMLDivElement | null>
}

interface NotePopupState {
  mode: 'create' | 'edit'
  /** edit only */
  highlightId?: string
  rects: NormRect[]
  text: string
  anchor: EpubAnchor
  color: string
  opacity: number
  popupLeft: number
  popupTop: number
  note: string
}

const NOTE_MAX_LENGTH = 1000
const POPUP_WIDTH = 260
/** Approx height for initial placement; refined after mount */
const POPUP_HEIGHT_EST = 260

function clampPopupPos(
  left: number,
  top: number,
  width = POPUP_WIDTH,
  height = POPUP_HEIGHT_EST
): { left: number; top: number } {
  const margin = 8
  const maxLeft = Math.max(margin, window.innerWidth - width - margin)
  const maxTop = Math.max(margin, window.innerHeight - height - margin)
  return {
    left: Math.max(margin, Math.min(left, maxLeft)),
    top: Math.max(margin, Math.min(top, maxTop))
  }
}

/** Place near anchor; prefer below, flip above if not enough room */
function popupPosNearClient(
  clientX: number,
  clientY: number,
  preferBelow = true
): { left: number; top: number } {
  const margin = 8
  let left = clientX + margin
  let top = preferBelow ? clientY + margin : clientY - POPUP_HEIGHT_EST - margin
  if (preferBelow && clientY + margin + POPUP_HEIGHT_EST > window.innerHeight - margin) {
    top = clientY - POPUP_HEIGHT_EST - margin
  }
  return clampPopupPos(left, top)
}

function findChapterAnchor(
  scrollEl: HTMLElement,
  clientX: number,
  clientY: number
): EpubAnchor {
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

function overlapArea(a: NormRect, b: NormRect): number {
  const ax2 = a[0] + a[2]
  const ay2 = a[1] + a[3]
  const bx2 = b[0] + b[2]
  const by2 = b[1] + b[3]
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a[0], b[0]))
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a[1], b[1]))
  return ix * iy
}

export function selectionOverlapsExisting(
  newRects: NormRect[],
  existing: AnnotationHighlight[]
): boolean {
  const EPS = 1e-8
  for (const hl of existing) {
    for (const nr of newRects) {
      for (const er of hl.rects) {
        if (overlapArea(nr, er) > EPS) return true
      }
    }
  }
  return false
}

function clientToDocNormalized(
  clientX: number,
  clientY: number,
  scrollEl: HTMLElement
): [number, number] {
  const rect = scrollEl.getBoundingClientRect()
  const docX = scrollEl.scrollLeft + (clientX - rect.left)
  const docY = scrollEl.scrollTop + (clientY - rect.top)
  const w = Math.max(1, scrollEl.scrollWidth)
  const h = Math.max(1, scrollEl.scrollHeight)
  return [
    Math.max(0, Math.min(1, docX / w)),
    Math.max(0, Math.min(1, docY / h))
  ]
}

function hitHighlightAt(
  nx: number,
  ny: number,
  highlights: AnnotationHighlight[]
): AnnotationHighlight | null {
  for (let i = highlights.length - 1; i >= 0; i--) {
    const hl = highlights[i]
    for (const [rx, ry, rw, rh] of hl.rects) {
      if (nx >= rx && nx <= rx + rw && ny >= ry && ny <= ry + rh) return hl
    }
  }
  return null
}

/**
 * Mark: new selection → note popup; click existing highlight → view/edit note.
 */
export default function MarkSelectionHandler({ scrollRef }: Props) {
  const { t } = useI18n()
  const activeTool = useAnnotationStore((s) => s.activeTool)
  const markColor = useAnnotationStore((s) => s.markColor)
  const markOpacity = useAnnotationStore((s) => s.markOpacity)
  const highlights = useAnnotationStore((s) => s.highlights)
  const addHighlight = useAnnotationStore((s) => s.addHighlight)
  const updateHighlight = useAnnotationStore((s) => s.updateHighlight)

  const [popup, setPopup] = useState<NotePopupState | null>(null)
  const [overlapHint, setOverlapHint] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const highlightsRef = useRef(highlights)
  highlightsRef.current = highlights
  const mouseDownRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (activeTool !== 'mark') {
      setPopup(null)
      setOverlapHint(false)
    }
  }, [activeTool])

  useEffect(() => {
    if (popup) requestAnimationFrame(() => textareaRef.current?.focus())
  }, [popup])

  // After paint: clamp to viewport using real popup size (escapes overflow:hidden ancestors)
  useEffect(() => {
    if (!popup || !popupRef.current) return
    const el = popupRef.current
    const rect = el.getBoundingClientRect()
    const next = clampPopupPos(popup.popupLeft, popup.popupTop, rect.width, rect.height)
    if (next.left !== popup.popupLeft || next.top !== popup.popupTop) {
      setPopup((p) => (p ? { ...p, popupLeft: next.left, popupTop: next.top } : p))
    }
  }, [popup])

  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return

    const onMouseDown = (e: MouseEvent) => {
      mouseDownRef.current = { x: e.clientX, y: e.clientY }
    }

    const onMouseUp = (e: MouseEvent) => {
      if (popup) return

      const down = mouseDownRef.current
      mouseDownRef.current = null
      const moved =
        down != null &&
        (Math.abs(e.clientX - down.x) > 4 || Math.abs(e.clientY - down.y) > 4)

      requestAnimationFrame(() => {
        const sel = window.getSelection()
        const hasSelection = !!(sel && !sel.isCollapsed && sel.rangeCount > 0)

        // Click (no drag): open existing highlight note
        if (!moved && !hasSelection) {
          const [nx, ny] = clientToDocNormalized(e.clientX, e.clientY, scrollEl)
          const hit = hitHighlightAt(nx, ny, highlightsRef.current)
          if (!hit) return
          const pos = popupPosNearClient(e.clientX, e.clientY)
          setPopup({
            mode: 'edit',
            highlightId: hit.id,
            rects: hit.rects,
            text: hit.text || '',
            anchor: hit.anchor,
            color: hit.color,
            opacity: hit.opacity,
            popupLeft: pos.left,
            popupTop: pos.top,
            note: (hit.note || '').slice(0, NOTE_MAX_LENGTH)
          })
          return
        }

        // New mark only in mark tool with a real selection
        if (activeTool !== 'mark') return
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) return
        const range = sel.getRangeAt(0)
        if (!scrollEl.contains(range.commonAncestorContainer)) return

        const rects = selectionToNormRects(scrollEl, range)
        if (rects.length === 0) return

        if (selectionOverlapsExisting(rects, highlightsRef.current)) {
          setOverlapHint(true)
          window.setTimeout(() => setOverlapHint(false), 1800)
          sel.removeAllRanges()
          return
        }

        const text = sel.toString().trim().slice(0, 500)
        const rangeBox = range.getBoundingClientRect()
        const preferBelow = rangeBox.bottom + POPUP_HEIGHT_EST + 8 < window.innerHeight
        const pos = preferBelow
          ? popupPosNearClient(rangeBox.left, rangeBox.bottom, true)
          : popupPosNearClient(rangeBox.left, rangeBox.top, false)
        const color = markColor
        const opacity = markOpacity
        const anchor = findChapterAnchor(scrollEl, e.clientX, e.clientY)

        // Popup first — preview paint deferred so mouseup stays responsive
        setPopup({
          mode: 'create',
          rects,
          text,
          anchor,
          color,
          opacity,
          popupLeft: pos.left,
          popupTop: pos.top,
          note: ''
        })
        sel.removeAllRanges()
        requestAnimationFrame(() => {
          useAnnotationStore.getState().setPreviewMark({ rects, color, opacity })
        })
      })
    }

    scrollEl.addEventListener('mousedown', onMouseDown)
    scrollEl.addEventListener('mouseup', onMouseUp)
    return () => {
      scrollEl.removeEventListener('mousedown', onMouseDown)
      scrollEl.removeEventListener('mouseup', onMouseUp)
    }
  }, [activeTool, markColor, markOpacity, popup, scrollRef])

  const handleSave = () => {
    if (!popup) return
    const noteText = popup.note.trim().slice(0, NOTE_MAX_LENGTH) || undefined
    if (popup.mode === 'edit' && popup.highlightId) {
      updateHighlight(popup.highlightId, { note: noteText })
    } else {
      const hl: AnnotationHighlight = {
        id: crypto.randomUUID(),
        tool: 'mark',
        color: popup.color,
        opacity: popup.opacity,
        rects: popup.rects,
        text: popup.text || undefined,
        note: noteText,
        anchor: popup.anchor,
        createdAt: Date.now()
      }
      addHighlight(hl)
    }
    useAnnotationStore.getState().setPreviewMark(null)
    setPopup(null)
  }

  const handleCancel = () => {
    useAnnotationStore.getState().setPreviewMark(null)
    setPopup(null)
  }

  return (
    <>
      {overlapHint && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] px-3 py-1.5 text-xs rounded-lg
                        chrome-surface-raised border border-[var(--reader-border)] shadow-md chrome-muted">
          {t('annotation.alreadyMarked')}
        </div>
      )}

      {popup && (
        <div
          ref={popupRef}
          className="fixed z-[60] flex flex-col w-[260px] min-w-[220px] min-h-[160px]
                     max-w-[min(480px,92vw)] max-h-[min(520px,75vh)]
                     overflow-auto resize chrome-surface-raised rounded-lg shadow-lg
                     border border-[var(--reader-border)] p-3"
          style={{ left: popup.popupLeft, top: popup.popupTop }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2 shrink-0">
            <span className="text-sm font-medium">{t('annotation.noteTitle')}</span>
            <button
              type="button"
              onClick={handleCancel}
              className="p-0.5 chrome-muted hover:opacity-80"
              aria-label={t('annotation.close')}
            >
              <X size={14} />
            </button>
          </div>
          {popup.text ? (
            <p className="text-[11px] chrome-muted mb-1.5 line-clamp-2 leading-snug shrink-0">
              {popup.text}
            </p>
          ) : null}
          <textarea
            ref={textareaRef}
            value={popup.note}
            onChange={(e) =>
              setPopup({ ...popup, note: e.target.value.slice(0, NOTE_MAX_LENGTH) })
            }
            maxLength={NOTE_MAX_LENGTH}
            rows={4}
            className="flex-1 min-h-[88px] w-full resize-none text-sm rounded border border-[var(--reader-border)]
                       bg-[var(--reader-bg)] px-2 py-1.5 outline-none focus:ring-1 focus:ring-scroll-400"
            placeholder={t('annotation.notePlaceholder')}
            onKeyDown={(e) => {
              if (e.key === 'Escape') handleCancel()
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave()
            }}
          />
          <div className="flex items-center justify-between gap-2 mt-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                const text = (popup.note || popup.text || '').trim()
                if (text) {
                  useAppStore.getState().setAiContext({ selection: text.slice(0, 3000) })
                  useAppStore.getState().setAiDraft(
                    `${t('ai.askAboutSelection')}\n「${text.slice(0, 200)}${text.length > 200 ? '…' : ''}」\n\n`
                  )
                  useAppStore.getState().setRequestAiPanel(true)
                }
              }}
              className="text-[11px] text-scroll-600 hover:underline"
            >
              {t('ai.askAi')}
            </button>
            <div className="flex items-center gap-2">
            <span className="text-[11px] chrome-muted tabular-nums">
              {popup.note.length}/{NOTE_MAX_LENGTH}
            </span>
            <button
              type="button"
              onClick={handleSave}
              className="p-1.5 rounded chrome-muted hover:text-scroll-600 hover:bg-scroll-50
                         dark:hover:bg-scroll-900/30 transition-colors"
              title={t('annotation.noteSave')}
            >
              <Check size={18} />
            </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
