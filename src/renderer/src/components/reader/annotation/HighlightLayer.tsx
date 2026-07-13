import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useAnnotationStore } from '../../../stores/annotationStore'
import { useAppStore } from '../../../stores/appStore'
import type { AnnotationHighlight, NormRect } from '../../../lib/annotationTypes'

interface Props {
  scrollRef: React.RefObject<HTMLDivElement | null>
  layoutKey?: string | number
}

function drawHighlights(
  ctx: CanvasRenderingContext2D,
  highlights: AnnotationHighlight[],
  docW: number,
  docH: number
): void {
  for (const hl of highlights) {
    ctx.save()
    ctx.fillStyle = hl.color
    ctx.globalAlpha = hl.opacity / 100
    for (const [nx, ny, nw, nh] of hl.rects) {
      ctx.fillRect(nx * docW, ny * docH, nw * docW, nh * docH)
    }
    ctx.restore()
  }
}

/** Highlight layer under brush canvas — never captures pointer */
export default function HighlightLayer({ scrollRef, layoutKey }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const highlights = useAnnotationStore((s) => s.highlights)
  const previewMark = useAnnotationStore((s) => s.previewMark)
  const fontSize = useAppStore((s) => s.readerFontSize)

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
    drawHighlights(ctx, highlights, docW, docH)
    if (previewMark) {
      drawHighlights(
        ctx,
        [
          {
            id: '__preview__',
            tool: 'mark',
            color: previewMark.color,
            opacity: previewMark.opacity,
            rects: previewMark.rects,
            anchor: { type: 'document' },
            createdAt: 0
          }
        ],
        docW,
        docH
      )
    }
    ctx.restore()
  }, [scrollRef, highlights, previewMark])

  useLayoutEffect(() => {
    redraw()
  }, [redraw, fontSize, layoutKey])

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

/** Convert Selection client rects → document-normalized rects */
export function selectionToNormRects(
  scrollEl: HTMLElement,
  range: Range
): NormRect[] {
  const scrollRect = scrollEl.getBoundingClientRect()
  const docW = Math.max(1, scrollEl.scrollWidth)
  const docH = Math.max(1, scrollEl.scrollHeight)
  const clientRects = Array.from(range.getClientRects())
  const out: NormRect[] = []
  for (const r of clientRects) {
    if (r.width < 1 || r.height < 1) continue
    const x = (scrollEl.scrollLeft + (r.left - scrollRect.left)) / docW
    const y = (scrollEl.scrollTop + (r.top - scrollRect.top)) / docH
    const w = r.width / docW
    const h = r.height / docH
    out.push([
      Math.max(0, Math.min(1, x)),
      Math.max(0, Math.min(1, y)),
      Math.max(0, Math.min(1, w)),
      Math.max(0, Math.min(1, h))
    ])
  }
  return out
}
