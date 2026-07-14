import type { AnnotationHighlight, NormRect } from './annotationTypes'
import { rangeFromTextOffsets } from './bookSearch'

/** Selection / Range client rects → document-normalized rects */
export function selectionToNormRects(scrollEl: HTMLElement, range: Range): NormRect[] {
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

function textLengthBeforeElement(root: HTMLElement, el: Element): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let pos = 0
  let n: Node | null
  while ((n = walker.nextNode())) {
    if (el.contains(n)) return pos
    pos += (n as Text).data.length
  }
  return pos
}

/** Map a Range boundary to absolute char offset inside root. */
export function pointToTextOffset(root: HTMLElement, container: Node, offset: number): number {
  if (container.nodeType === Node.TEXT_NODE) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let pos = 0
    let n: Node | null
    while ((n = walker.nextNode())) {
      if (n === container) {
        return pos + Math.max(0, Math.min(offset, (n as Text).data.length))
      }
      pos += (n as Text).data.length
    }
    return pos
  }

  if (!(container instanceof Element)) return 0
  const el = container
  if (offset <= 0) return textLengthBeforeElement(root, el)
  if (offset >= el.childNodes.length) {
    return textLengthBeforeElement(root, el) + (el.textContent?.length ?? 0)
  }
  const child = el.childNodes[offset]
  if (child.nodeType === Node.TEXT_NODE) {
    return pointToTextOffset(root, child, 0)
  }
  if (child instanceof Element) {
    return textLengthBeforeElement(root, child)
  }
  return textLengthBeforeElement(root, el)
}

export function offsetsFromRange(
  root: HTMLElement,
  range: Range
): { start: number; end: number } | null {
  try {
    if (!root.contains(range.commonAncestorContainer) && range.commonAncestorContainer !== root) {
      if (!root.contains(range.startContainer)) return null
    }
    const start = pointToTextOffset(root, range.startContainer, range.startOffset)
    const end = pointToTextOffset(root, range.endContainer, range.endOffset)
    if (end <= start) return null
    return { start, end }
  } catch {
    return null
  }
}

/** Locate quote in document; prefer match nearest hintNy (0–1). */
export function findTextRangeNear(
  root: HTMLElement,
  needle: string,
  hintNy?: number
): Range | null {
  const text = needle.trim()
  if (!text) return null

  const plain = root.textContent || ''
  let best: Range | null = null
  let bestDist = Infinity
  let from = 0

  while (from < plain.length) {
    const idx = plain.indexOf(text, from)
    if (idx < 0) break
    const end = idx + text.length
    const range = rangeFromTextOffsets(root, idx, end)
    if (range) {
      if (hintNy == null) return range
      const rects = selectionToNormRects(root, range)
      const cy = rects[0] ? rects[0][1] + rects[0][3] / 2 : 0
      const dist = Math.abs(cy - hintNy)
      if (dist < bestDist) {
        bestDist = dist
        best = range
      }
    }
    from = idx + Math.max(1, text.length)
  }
  return best
}

/**
 * Fresh layout-aware rects for a highlight.
 * Prefers text offsets → quote search → stored geometric rects.
 */
export function resolveHighlightRects(
  scrollEl: HTMLElement,
  hl: AnnotationHighlight
): NormRect[] {
  if (hl.textStart != null && hl.textEnd != null && hl.textEnd > hl.textStart) {
    const range = rangeFromTextOffsets(scrollEl, hl.textStart, hl.textEnd)
    if (range) {
      const rects = selectionToNormRects(scrollEl, range)
      if (rects.length > 0) return rects
    }
  }

  if (hl.text?.trim()) {
    const hintNy = hl.rects[0]?.[1]
    const range = findTextRangeNear(scrollEl, hl.text, hintNy)
    if (range) {
      const rects = selectionToNormRects(scrollEl, range)
      if (rects.length > 0) return rects
    }
  }

  return hl.rects
}
