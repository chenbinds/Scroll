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

function chapterSection(
  scrollEl: HTMLElement,
  chapterIndex?: number
): HTMLElement | null {
  if (chapterIndex == null) return null
  return (
    (scrollEl.querySelector(`[data-chapter="${chapterIndex}"]`) as HTMLElement | null) ||
    (scrollEl.querySelector(`[data-id="chapter-${chapterIndex}"]`) as HTMLElement | null) ||
    (scrollEl.querySelector(`[data-id="mobi-chapter-${chapterIndex}"]`) as HTMLElement | null)
  )
}

/** Find quote inside an element; disambiguate duplicates with hintNy in scrollEl space. */
function findTextRangeInElement(
  searchRoot: HTMLElement,
  needle: string,
  scrollEl: HTMLElement,
  hintNy?: number
): Range | null {
  const text = needle.trim()
  if (!text) return null

  const plain = searchRoot.textContent || ''
  const hits: number[] = []
  let from = 0
  while (from < plain.length) {
    const idx = plain.indexOf(text, from)
    if (idx < 0) break
    hits.push(idx)
    from = idx + Math.max(1, text.length)
  }
  if (hits.length === 0) return null

  const toRange = (localStart: number) =>
    rangeFromTextOffsets(searchRoot, localStart, localStart + text.length)

  if (hits.length === 1 || hintNy == null) {
    return toRange(hits[0])
  }

  let best: Range | null = null
  let bestDist = Infinity
  for (const localStart of hits) {
    const range = toRange(localStart)
    if (!range) continue
    const rects = selectionToNormRects(scrollEl, range)
    const cy = rects[0] ? rects[0][1] + rects[0][3] / 2 : 0
    const dist = Math.abs(cy - hintNy)
    if (dist < bestDist) {
      bestDist = dist
      best = range
    }
  }
  return best
}

/**
 * Live DOM Range for a highlight — layout-stable across font / sidebar changes.
 * Search order: stored offsets → chapter-scoped quote → full-document quote → null.
 */
export function resolveHighlightRange(
  scrollEl: HTMLElement,
  hl: AnnotationHighlight
): Range | null {
  if (hl.textStart != null && hl.textEnd != null && hl.textEnd > hl.textStart) {
    const range = rangeFromTextOffsets(scrollEl, hl.textStart, hl.textEnd)
    if (range) return range
  }

  const text = hl.text?.trim()
  if (!text) return null

  const hintNy = hl.rects[0]?.[1]
  const chapter = chapterSection(scrollEl, hl.anchor.chapterIndex)
  if (chapter) {
    const inChapter = findTextRangeInElement(chapter, text, scrollEl, hintNy)
    if (inChapter) return inChapter
  }

  return findTextRangeInElement(scrollEl, text, scrollEl, hintNy)
}

/**
 * Fresh layout-aware rects for a highlight.
 */
export function resolveHighlightRects(
  scrollEl: HTMLElement,
  hl: AnnotationHighlight
): NormRect[] {
  const range = resolveHighlightRange(scrollEl, hl)
  if (range) {
    const rects = selectionToNormRects(scrollEl, range)
    if (rects.length > 0) return rects
  }
  return hl.rects
}

/** @deprecated use resolveHighlightRange */
export function findTextRangeNear(
  root: HTMLElement,
  needle: string,
  hintNy?: number
): Range | null {
  return findTextRangeInElement(root, needle, root, hintNy)
}
