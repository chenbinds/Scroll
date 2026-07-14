import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useAnnotationStore } from '../../../stores/annotationStore'
import { useAppStore } from '../../../stores/appStore'
import type { AnnotationHighlight, NormRect } from '../../../lib/annotationTypes'
import { resolveHighlightRects, selectionToNormRects } from '../../../lib/highlightRects'

export { selectionToNormRects }

interface Props {
  scrollRef: React.RefObject<HTMLDivElement | null>
  layoutKey?: string | number
}

function drawNormRects(
  ctx: CanvasRenderingContext2D,
  rects: NormRect[],
  color: string,
  opacity: number,
  docW: number,
  docH: number
): void {
  ctx.save()
  ctx.fillStyle = color
  ctx.globalAlpha = opacity / 100
  for (const [nx, ny, nw, nh] of rects) {
    ctx.fillRect(nx * docW, ny * docH, nw * docW, nh * docH)
  }
  ctx.restore()
}

function drawHighlights(
  ctx: CanvasRenderingContext2D,
  scrollEl: HTMLElement,
  highlights: AnnotationHighlight[],
  docW: number,
  docH: number
): void {
  for (const hl of highlights) {
    const rects = resolveHighlightRects(scrollEl, hl)
    drawNormRects(ctx, rects, hl.color, hl.opacity, docW, docH)
  }
}

/** Highlight layer under brush canvas — never captures pointer */
export default function HighlightLayer({ scrollRef, layoutKey }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const highlights = useAnnotationStore((s) => s.highlights)
  const previewMark = useAnnotationStore((s) => s.previewMark)
  const fontSize = useAppStore((s) => s.readerFontSize)
  const leftSidebarOpen = useAppStore((s) => s.leftSidebarOpen)
  const rightSidebarOpen = useAppStore((s) => s.rightSidebarOpen)
  const readingLineHeight = useAppStore((s) => s.readingLineHeight)
  const readingParagraphGap = useAppStore((s) => s.readingParagraphGap)
  const readingPageMargin = useAppStore((s) => s.readingPageMargin)

  const highlightsRef = useRef(highlights)
  highlightsRef.current = highlights
  const previewRef = useRef(previewMark)
  previewRef.current = previewMark

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
    drawHighlights(ctx, scrollEl, highlightsRef.current, docW, docH)
    const preview = previewRef.current
    if (preview) {
      drawNormRects(ctx, preview.rects, preview.color, preview.opacity, docW, docH)
    }
    ctx.restore()
  }, [scrollRef])

  useLayoutEffect(() => {
    // Layout may still settle after font/sidebar change — redraw a few times
    redraw()
    const t1 = window.setTimeout(redraw, 50)
    const t2 = window.setTimeout(redraw, 200)
    const t3 = window.setTimeout(redraw, 500)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [highlights, fontSize, layoutKey, leftSidebarOpen, rightSidebarOpen, readingLineHeight, readingParagraphGap, readingPageMargin, redraw])

  // Preview must not block first selection (mouseup → popup)
  useEffect(() => {
    const id = requestAnimationFrame(() => redraw())
    return () => cancelAnimationFrame(id)
  }, [previewMark, redraw])

  // Warm canvas + cheap Range.getClientRects before first mark
  useEffect(() => {
    const warm = () => {
      const scrollEl = scrollRef.current
      if (scrollEl) {
        try {
          const walker = document.createTreeWalker(scrollEl, NodeFilter.SHOW_TEXT)
          const text = walker.nextNode()
          if (text && text.textContent) {
            const range = document.createRange()
            const len = Math.min(1, text.textContent.length)
            range.setStart(text, 0)
            range.setEnd(text, len)
            range.getClientRects()
          }
        } catch {
          // ignore
        }
      }
      redraw()
    }
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(warm, { timeout: 600 })
      return () => w.cancelIdleCallback?.(id)
    }
    const t = window.setTimeout(warm, 120)
    return () => clearTimeout(t)
  }, [redraw, scrollRef])

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
    if (scrollEl.firstElementChild) ro.observe(scrollEl.firstElementChild)
    return () => {
      scrollEl.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      ro.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [scrollRef, redraw])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-[4]"
      style={{ pointerEvents: 'none', background: 'transparent' }}
    />
  )
}
