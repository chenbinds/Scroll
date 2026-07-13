import type { AnnotationAnchor, AnnotationStroke, BrushShape } from './annotationTypes'

export function isPageLocalAnchor(anchor: AnnotationAnchor): boolean {
  return anchor.type === 'pdf-page'
}

export function getPageElement(scrollEl: HTMLElement, pageNum: number): HTMLElement | null {
  return scrollEl.querySelector(`[data-page="${pageNum}"]`) as HTMLElement | null
}

export function getPageBoxInScroll(
  scrollEl: HTMLElement,
  pageEl: HTMLElement
): { left: number; top: number; width: number; height: number } {
  const scrollRect = scrollEl.getBoundingClientRect()
  const pageRect = pageEl.getBoundingClientRect()
  return {
    left: scrollEl.scrollLeft + (pageRect.left - scrollRect.left),
    top: scrollEl.scrollTop + (pageRect.top - scrollRect.top),
    width: Math.max(1, pageRect.width),
    height: Math.max(1, pageRect.height)
  }
}

export function clientToPageNormalized(
  clientX: number,
  clientY: number,
  pageEl: HTMLElement
): [number, number] {
  const rect = pageEl.getBoundingClientRect()
  return [
    Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width))),
    Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(1, rect.height)))
  ]
}

/** Map page-local 0~1 coords to document pixel space for drawing / hit-test */
export function pageLocalToDocPixel(
  nx: number,
  ny: number,
  scrollEl: HTMLElement,
  pageNum: number
): [number, number] | null {
  const pageEl = getPageElement(scrollEl, pageNum)
  if (!pageEl) return null
  const box = getPageBoxInScroll(scrollEl, pageEl)
  return [box.left + nx * box.width, box.top + ny * box.height]
}

export function drawStrokeOnScroll(
  ctx: CanvasRenderingContext2D,
  stroke: AnnotationStroke,
  scrollEl: HTMLElement
): void {
  if (isPageLocalAnchor(stroke.anchor)) {
    const pageEl = getPageElement(scrollEl, stroke.anchor.pageNum)
    if (!pageEl) return
    const box = getPageBoxInScroll(scrollEl, pageEl)
    ctx.save()
    ctx.translate(box.left, box.top)
    drawStrokeOnCanvas(ctx, stroke, box.width, box.height)
    ctx.restore()
    return
  }
  drawStrokeOnCanvas(ctx, stroke, scrollEl.scrollWidth, scrollEl.scrollHeight)
}

export function hitTestStrokeOnScroll(
  stroke: AnnotationStroke,
  clientX: number,
  clientY: number,
  scrollEl: HTMLElement
): boolean {
  const scrollRect = scrollEl.getBoundingClientRect()
  const docX = scrollEl.scrollLeft + (clientX - scrollRect.left)
  const docY = scrollEl.scrollTop + (clientY - scrollRect.top)

  if (isPageLocalAnchor(stroke.anchor)) {
    const pageEl = getPageElement(scrollEl, stroke.anchor.pageNum)
    if (!pageEl) return false
    const box = getPageBoxInScroll(scrollEl, pageEl)
    const nx = (docX - box.left) / box.width
    const ny = (docY - box.top) / box.height
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return false
    return hitTestStroke(stroke, nx, ny, box.width, box.height)
  }

  const docW = Math.max(1, scrollEl.scrollWidth)
  const docH = Math.max(1, scrollEl.scrollHeight)
  return hitTestStroke(stroke, docX / docW, docY / docH, docW, docH)
}

export function normalizedToPixel(
  nx: number,
  ny: number,
  width: number,
  height: number
): [number, number] {
  return [nx * width, ny * height]
}

export function drawStrokeOnCanvas(
  ctx: CanvasRenderingContext2D,
  stroke: Pick<AnnotationStroke, 'shape' | 'points' | 'color' | 'opacity' | 'lineWidth'>,
  width: number,
  height: number
): void {
  if (stroke.points.length === 0) return

  const pts = stroke.points.map(([nx, ny]) => normalizedToPixel(nx, ny, width, height))

  ctx.save()
  ctx.strokeStyle = stroke.color
  ctx.fillStyle = stroke.color
  ctx.globalAlpha = stroke.opacity / 100
  ctx.lineWidth = stroke.lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  switch (stroke.shape) {
    case 'curve':
    case 'polyline':
    case 'polygon':
      drawPolyPath(ctx, pts, stroke.shape === 'polygon')
      break
    case 'line':
      drawLine(ctx, pts)
      break
    case 'arrow':
      drawLine(ctx, pts)
      drawArrowHead(ctx, pts)
      break
    case 'rect':
      drawRect(ctx, pts)
      break
    case 'circle':
      drawCircle(ctx, pts)
      break
    case 'star':
      drawStar(ctx, pts)
      break
    default:
      drawPolyPath(ctx, pts, false)
  }

  ctx.restore()
}

function drawPolyPath(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  close: boolean
): void {
  if (pts.length < 2) {
    if (pts.length === 1) {
      ctx.beginPath()
      ctx.arc(pts[0][0], pts[0][1], ctx.lineWidth / 2, 0, Math.PI * 2)
      ctx.fill()
    }
    return
  }
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i][0], pts[i][1])
  }
  if (close) ctx.closePath()
  ctx.stroke()
}

function drawLine(ctx: CanvasRenderingContext2D, pts: [number, number][]): void {
  if (pts.length < 2) return
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1])
  ctx.stroke()
}

function drawArrowHead(ctx: CanvasRenderingContext2D, pts: [number, number][]): void {
  if (pts.length < 2) return
  const [x1, y1] = pts[0]
  const [x2, y2] = pts[pts.length - 1]
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const headLen = Math.max(8, ctx.lineWidth * 3)
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(
    x2 - headLen * Math.cos(angle - Math.PI / 6),
    y2 - headLen * Math.sin(angle - Math.PI / 6)
  )
  ctx.moveTo(x2, y2)
  ctx.lineTo(
    x2 - headLen * Math.cos(angle + Math.PI / 6),
    y2 - headLen * Math.sin(angle + Math.PI / 6)
  )
  ctx.stroke()
}

function drawRect(ctx: CanvasRenderingContext2D, pts: [number, number][]): void {
  if (pts.length < 2) return
  const [x1, y1] = pts[0]
  const [x2, y2] = pts[pts.length - 1]
  ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
}

function drawCircle(ctx: CanvasRenderingContext2D, pts: [number, number][]): void {
  if (pts.length < 2) return
  const [x1, y1] = pts[0]
  const [x2, y2] = pts[pts.length - 1]
  const rx = Math.abs(x2 - x1) / 2
  const ry = Math.abs(y2 - y1) / 2
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2
  ctx.beginPath()
  ctx.ellipse(cx, cy, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2)
  ctx.stroke()
}

function drawStar(ctx: CanvasRenderingContext2D, pts: [number, number][]): void {
  if (pts.length < 2) return
  const [x1, y1] = pts[0]
  const [x2, y2] = pts[pts.length - 1]
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2
  const outerR = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) / 2
  const innerR = outerR * 0.4
  const spikes = 5
  ctx.beginPath()
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR
    const a = (Math.PI / 2) * -1 + (i * Math.PI) / spikes
    const x = cx + r * Math.cos(a)
    const y = cy + r * Math.sin(a)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.stroke()
}

/** Distance from point to segment in document pixels */
function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

/** Hit-test stroke in document pixel space; threshold ≈ lineWidth * 3 */
export function hitTestStroke(
  stroke: AnnotationStroke,
  nx: number,
  ny: number,
  docW: number,
  docH: number
): boolean {
  if (stroke.points.length === 0) return false
  const px = nx * docW
  const py = ny * docH
  const threshold = Math.max(8, stroke.lineWidth * 3)
  const pts = stroke.points.map(([a, b]) => normalizedToPixel(a, b, docW, docH))

  if (stroke.shape === 'rect' || stroke.shape === 'circle' || stroke.shape === 'star') {
    if (pts.length < 2) return false
    const [x1, y1] = pts[0]
    const [x2, y2] = pts[pts.length - 1]
    const minX = Math.min(x1, x2)
    const maxX = Math.max(x1, x2)
    const minY = Math.min(y1, y2)
    const maxY = Math.max(y1, y2)

    if (stroke.shape === 'circle') {
      const cx = (minX + maxX) / 2
      const cy = (minY + maxY) / 2
      const rx = Math.max((maxX - minX) / 2, 0.5)
      const ry = Math.max((maxY - minY) / 2, 0.5)
      const nx2 = (px - cx) / rx
      const ny2 = (py - cy) / ry
      const d = Math.hypot(nx2, ny2)
      // Hollow ellipse: hit near rim
      return Math.abs(d - 1) * Math.min(rx, ry) <= threshold
    }

    const nearEdge =
      (px >= minX - threshold && px <= maxX + threshold &&
        (Math.abs(py - minY) <= threshold || Math.abs(py - maxY) <= threshold)) ||
      (py >= minY - threshold && py <= maxY + threshold &&
        (Math.abs(px - minX) <= threshold || Math.abs(px - maxX) <= threshold))
    const inside = px >= minX && px <= maxX && py >= minY && py <= maxY
    const tiny =
      maxX - minX < threshold * 4 || maxY - minY < threshold * 4
    return nearEdge || (inside && tiny)
  }

  if (pts.length === 1) {
    return Math.hypot(px - pts[0][0], py - pts[0][1]) <= threshold
  }

  for (let i = 1; i < pts.length; i++) {
    if (distToSegment(px, py, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) <= threshold) {
      return true
    }
  }
  if (stroke.shape === 'polygon' && pts.length >= 3) {
    const last = pts[pts.length - 1]
    const first = pts[0]
    if (distToSegment(px, py, last[0], last[1], first[0], first[1]) <= threshold) return true
  }
  return false
}

export function isDragShape(shape: BrushShape): boolean {
  return shape === 'curve' || shape === 'line' || shape === 'arrow' ||
    shape === 'rect' || shape === 'circle' || shape === 'star'
}

export function isClickShape(shape: BrushShape): boolean {
  return shape === 'polyline' || shape === 'polygon'
}
