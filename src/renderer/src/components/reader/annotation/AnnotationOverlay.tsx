import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useAnnotationStore } from '../../../stores/annotationStore'
import { useAppStore } from '../../../stores/appStore'
import {
  drawStrokeOnCanvas,
  hitTestStroke,
  isClickShape,
  isDragShape
} from '../../../lib/annotationDraw'
import type { AnnotationStroke, BrushShape, AnnotationAnchor } from '../../../lib/annotationTypes'

interface Props {
  scrollRef: React.RefObject<HTMLDivElement | null>
  /** Bump when layout changes without viewport resize (e.g. PDF zoom) */
  layoutKey?: string | number
}

type Draft =
  | { mode: 'drag'; shape: BrushShape; points: [number, number][]; lastPx: [number, number] | null }
  | { mode: 'click'; shape: BrushShape; points: [number, number][] }

function findContentAnchor(
  scrollEl: HTMLElement,
  clientX: number,
  clientY: number
): AnnotationAnchor {
  const sections = scrollEl.querySelectorAll('[data-chapter]')
  for (const section of sections) {
    const rect = section.getBoundingClientRect()
    if (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    ) {
      const el = section as HTMLElement
      return {
        type: 'document',
        chapterHref: el.dataset.href,
        chapterIndex: Number(el.dataset.chapter)
      }
    }
  }
  const pages = scrollEl.querySelectorAll('div[data-page]')
  for (const page of pages) {
    const rect = page.getBoundingClientRect()
    if (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    ) {
      return {
        type: 'pdf-page',
        pageNum: Number((page as HTMLElement).dataset.page) || 1
      }
    }
  }
  return { type: 'document' }
}

function minDist(a: [number, number], b: [number, number], w: number, h: number): number {
  const dx = (a[0] - b[0]) * w
  const dy = (a[1] - b[1]) * h
  return Math.sqrt(dx * dx + dy * dy)
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

function finalizeDragPoints(shape: BrushShape, points: [number, number][]): [number, number][] {
  if (points.length === 0) return points
  if (shape === 'curve') return points
  // Two-point shapes: keep start + last
  if (points.length === 1) return points
  return [points[0], points[points.length - 1]]
}

/**
 * Viewport-sized canvas sibling of reader-scroll.
 * Does NOT wrap or modify EPUB content DOM.
 */
export default function AnnotationOverlay({ scrollRef, layoutKey }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const draftRef = useRef<Draft | null>(null)
  const erasingRef = useRef(false)

  const activeTool = useAnnotationStore((s) => s.activeTool)
  const brush = useAnnotationStore((s) => s.brush)
  const strokes = useAnnotationStore((s) => s.strokes)
  const highlights = useAnnotationStore((s) => s.highlights)
  const addStroke = useAnnotationStore((s) => s.addStroke)
  const removeStroke = useAnnotationStore((s) => s.removeStroke)
  const removeHighlight = useAnnotationStore((s) => s.removeHighlight)
  const setPanelOpen = useAnnotationStore((s) => s.setPanelOpen)
  const setHasClickDraft = useAnnotationStore((s) => s.setHasClickDraft)
  const fontSize = useAppStore((s) => s.readerFontSize)

  const interactive = activeTool === 'brush' || activeTool === 'eraser'

  const redraw = useCallback(() => {
    const scrollEl = scrollRef.current
    const canvas = canvasRef.current
    if (!scrollEl || !canvas) return

    const vw = Math.max(1, scrollEl.clientWidth)
    const vh = Math.max(1, scrollEl.clientHeight)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const bw = Math.round(vw * dpr)
    const bh = Math.round(vh * dpr)
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw
      canvas.height = bh
    }
    canvas.style.width = `${vw}px`
    canvas.style.height = `${vh}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, vw, vh)

    const docW = Math.max(1, scrollEl.scrollWidth)
    const docH = Math.max(1, scrollEl.scrollHeight)

    ctx.save()
    ctx.translate(-scrollEl.scrollLeft, -scrollEl.scrollTop)

    for (const stroke of strokes) {
      drawStrokeOnCanvas(ctx, stroke, docW, docH)
    }

    const draft = draftRef.current
    if (draft && draft.points.length > 0) {
      const pts =
        draft.mode === 'drag'
          ? finalizeDragPoints(draft.shape, draft.points)
          : draft.points
      drawStrokeOnCanvas(
        ctx,
        {
          shape: draft.shape,
          points: pts,
          color: brush.color,
          opacity: brush.opacity,
          lineWidth: brush.lineWidth
        },
        docW,
        docH
      )
    }
    ctx.restore()
  }, [scrollRef, strokes, brush])

  // Clear in-progress click draft when shape/tool changes (not on every redraw)
  const brushShape = brush.shape
  useEffect(() => {
    if (!draftRef.current) return
    draftRef.current = null
    setHasClickDraft(false)
  }, [brushShape, activeTool, setHasClickDraft])

  useLayoutEffect(() => {
    redraw()
  }, [redraw, fontSize, interactive, brushShape, activeTool, layoutKey])

  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return

    let raf = 0
    const schedule = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        redraw()
      })
    }

    scrollEl.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    const ro = new ResizeObserver(schedule)
    ro.observe(scrollEl)
    // Content height can change (PDF zoom / EPUB load) without resizing the viewport box
    if (scrollEl.firstElementChild) ro.observe(scrollEl.firstElementChild)

    return () => {
      scrollEl.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      ro.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [scrollRef, redraw])

  // Esc cancels click-shape draft
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (draftRef.current?.mode === 'click') {
        draftRef.current = null
        setHasClickDraft(false)
        redraw()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [redraw, setHasClickDraft])

  const commitStroke = useCallback(
    (shape: BrushShape, points: [number, number][], clientX: number, clientY: number) => {
      const scrollEl = scrollRef.current
      if (!scrollEl || points.length < 2) return
      const stroke: AnnotationStroke = {
        id: crypto.randomUUID(),
        tool: 'brush',
        shape,
        points,
        color: brush.color,
        opacity: brush.opacity,
        lineWidth: brush.lineWidth,
        anchor: findContentAnchor(scrollEl, clientX, clientY),
        createdAt: Date.now()
      }
      addStroke(stroke)
    },
    [addStroke, brush, scrollRef]
  )

  const eraseAt = useCallback(
    (clientX: number, clientY: number) => {
      const scrollEl = scrollRef.current
      if (!scrollEl) return
      const [nx, ny] = clientToDocNormalized(clientX, clientY, scrollEl)
      const docW = scrollEl.scrollWidth
      const docH = scrollEl.scrollHeight
      for (let i = strokes.length - 1; i >= 0; i--) {
        if (hitTestStroke(strokes[i], nx, ny, docW, docH)) {
          removeStroke(strokes[i].id)
          return
        }
      }
      // Also erase highlights
      for (let i = highlights.length - 1; i >= 0; i--) {
        const hl = highlights[i]
        for (const [rx, ry, rw, rh] of hl.rects) {
          if (nx >= rx && nx <= rx + rw && ny >= ry && ny <= ry + rh) {
            removeHighlight(hl.id)
            return
          }
        }
      }
    },
    [highlights, removeHighlight, removeStroke, scrollRef, strokes]
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const scrollEl = scrollRef.current
      if (!scrollEl) return

      if (activeTool === 'eraser') {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        erasingRef.current = true
        eraseAt(e.clientX, e.clientY)
        return
      }

      if (activeTool !== 'brush') return

      e.preventDefault()
      e.stopPropagation()
      setPanelOpen(false)

      const pt = clientToDocNormalized(e.clientX, e.clientY, scrollEl)
      const shape = brush.shape

      if (isClickShape(shape)) {
        const existing = draftRef.current
        if (existing?.mode === 'click' && existing.shape === shape) {
          // Double-click finish
          if (e.detail >= 2) {
            if (existing.points.length >= 2) {
              commitStroke(shape, existing.points, e.clientX, e.clientY)
            }
            draftRef.current = null
            setHasClickDraft(false)
            redraw()
            return
          }
          existing.points.push(pt)
          redraw()
          return
        }
        draftRef.current = { mode: 'click', shape, points: [pt] }
        setHasClickDraft(true)
        redraw()
        return
      }

      if (isDragShape(shape)) {
        e.currentTarget.setPointerCapture(e.pointerId)
        draftRef.current = { mode: 'drag', shape, points: [pt], lastPx: pt }
        setHasClickDraft(false)
        redraw()
      }
    },
    [activeTool, brush.shape, commitStroke, eraseAt, redraw, scrollRef, setHasClickDraft, setPanelOpen]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const scrollEl = scrollRef.current
      if (!scrollEl) return

      if (activeTool === 'eraser' && erasingRef.current) {
        eraseAt(e.clientX, e.clientY)
        return
      }

      const draft = draftRef.current
      if (!draft || draft.mode !== 'drag') return

      const pt = clientToDocNormalized(e.clientX, e.clientY, scrollEl)
      if (draft.shape === 'curve') {
        const last = draft.lastPx
        if (last && minDist(last, pt, scrollEl.scrollWidth, scrollEl.scrollHeight) < 3) return
        draft.points.push(pt)
        draft.lastPx = pt
      } else {
        // Keep start + current end
        draft.points = [draft.points[0], pt]
        draft.lastPx = pt
      }
      redraw()
    },
    [activeTool, eraseAt, redraw, scrollRef]
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (erasingRef.current) {
        erasingRef.current = false
        try {
          e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {
          // ignore
        }
        return
      }

      const draft = draftRef.current
      if (!draft || draft.mode !== 'drag') return

      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }

      const points = finalizeDragPoints(draft.shape, draft.points)
      draftRef.current = null

      if (points.length < 2) {
        redraw()
        return
      }
      commitStroke(draft.shape, points, e.clientX, e.clientY)
    },
    [commitStroke, redraw]
  )

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-[5]"
      style={{
        pointerEvents: interactive ? 'auto' : 'none',
        cursor: activeTool === 'eraser' ? 'cell' : interactive ? 'crosshair' : 'default',
        touchAction: 'none',
        background: 'transparent'
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={(e) => {
        const scrollEl = scrollRef.current
        if (!scrollEl) return
        scrollEl.scrollBy({ top: e.deltaY, left: e.deltaX })
      }}
    />
  )
}
