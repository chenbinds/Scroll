/**
 * Layout-stable reading position via absolute text offset in the scroll root.
 * Survives font-size / sidebar width changes better than scroll-percent alone.
 */

import { rangeFromTextOffsets } from './bookSearch'

const VIEW_ALIGN = 0.2

export function textOffsetOfPoint(root: HTMLElement, clientX: number, clientY: number): number | null {
  const doc = root.ownerDocument
  if (!doc) return null

  let node: Node | null = null
  let offset = 0

  if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(clientX, clientY)
    if (range) {
      node = range.startContainer
      offset = range.startOffset
    }
  } else {
    const caretPos = (
      doc as Document & {
        caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
      }
    ).caretPositionFromPoint?.(clientX, clientY)
    if (caretPos) {
      node = caretPos.offsetNode
      offset = caretPos.offset
    }
  }

  if (!node || !root.contains(node)) return null
  return absoluteTextOffset(root, node, offset)
}

/** Char offset into root textContent for a text-node caret. */
export function absoluteTextOffset(root: HTMLElement, node: Node, nodeOffset: number): number {
  const target =
    node.nodeType === Node.TEXT_NODE
      ? node
      : (() => {
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
          return walker.nextNode()
        })()

  if (!target || target.nodeType !== Node.TEXT_NODE) {
    // Element caret: sum text before this element
    if (node.nodeType === Node.ELEMENT_NODE) {
      return textLengthBeforeElement(root, node as Element)
    }
    return 0
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let pos = 0
  let n: Node | null
  while ((n = walker.nextNode())) {
    if (n === target) {
      return pos + Math.max(0, Math.min(nodeOffset, (n as Text).data.length))
    }
    pos += (n as Text).data.length
  }
  return pos
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

/** Text offset near the reading line (~20% from top of the scroll viewport). */
export function readTextOffsetAtView(scrollEl: HTMLElement, alignRatio = VIEW_ALIGN): number {
  const rect = scrollEl.getBoundingClientRect()
  const y = rect.top + rect.height * alignRatio
  const x = rect.left + Math.min(48, rect.width * 0.15)

  const hit = textOffsetOfPoint(scrollEl, x, y)
  if (hit != null) return hit

  // Fallback: walk text node rects
  const walker = document.createTreeWalker(scrollEl, NodeFilter.SHOW_TEXT)
  let pos = 0
  let n: Node | null
  while ((n = walker.nextNode())) {
    const text = n as Text
    if (!text.data) continue
    const range = document.createRange()
    range.selectNodeContents(text)
    const r = range.getBoundingClientRect()
    if (r.height <= 0 && r.width <= 0) {
      pos += text.data.length
      continue
    }
    if (r.bottom >= y) {
      // Approximate within this node
      if (r.top <= y && text.data.length > 1) {
        const ratio = Math.min(1, Math.max(0, (y - r.top) / Math.max(1, r.height)))
        return pos + Math.floor(ratio * text.data.length)
      }
      return pos
    }
    pos += text.data.length
  }
  return pos
}

/** Scroll so the character at `offset` sits near the reading line. */
export function applyScrollToTextOffset(
  scrollEl: HTMLElement,
  offset: number,
  alignRatio = VIEW_ALIGN
): boolean {
  const totalLen = (() => {
    try {
      return (scrollEl.textContent || '').length
    } catch {
      return 0
    }
  })()
  if (totalLen <= 0) return false

  const clamped = Math.max(0, Math.min(offset, Math.max(0, totalLen - 1)))
  const end = Math.min(totalLen, clamped + 1)
  const range = rangeFromTextOffsets(scrollEl, clamped, Math.max(clamped + 1, end))
  if (!range) return false

  try {
    const rect = range.getBoundingClientRect()
    if (rect.height === 0 && rect.width === 0 && clamped > 0) {
      // Zero rect at boundary — nudge
      const alt = rangeFromTextOffsets(scrollEl, Math.max(0, clamped - 1), clamped)
      if (alt) {
        const ar = alt.getBoundingClientRect()
        const containerRect = scrollEl.getBoundingClientRect()
        const targetY = containerRect.top + containerRect.height * alignRatio
        scrollEl.scrollTop += ar.top - targetY
        return true
      }
    }
    const containerRect = scrollEl.getBoundingClientRect()
    const targetY = containerRect.top + containerRect.height * alignRatio
    scrollEl.scrollTop += rect.top - targetY
    return true
  } catch {
    return false
  }
}

/**
 * Restore by text offset and re-apply while layout settles
 * (fonts / sidebar / images changing scrollHeight).
 */
export function restoreScrollByTextOffset(
  getEl: () => HTMLElement | null,
  offset: number,
  options?: { maxMs?: number; settleMs?: number; alignRatio?: number }
): () => void {
  const maxMs = options?.maxMs ?? 4000
  const settleMs = options?.settleMs ?? 400
  const alignRatio = options?.alignRatio ?? VIEW_ALIGN
  const started = Date.now()
  let lastHeight = -1
  let stableSince = 0
  let ro: ResizeObserver | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let cancelled = false

  const apply = () => {
    if (cancelled) return
    const el = getEl()
    if (!el) return
    applyScrollToTextOffset(el, offset, alignRatio)
  }

  const finish = () => {
    if (cancelled) return
    cancelled = true
    ro?.disconnect()
    if (timer) clearTimeout(timer)
  }

  const onLayout = () => {
    if (cancelled) return
    const el = getEl()
    if (!el) return
    const h = el.scrollHeight
    apply()
    if (h === lastHeight) {
      if (!stableSince) stableSince = Date.now()
      else if (Date.now() - stableSince >= settleMs) finish()
    } else {
      lastHeight = h
      stableSince = 0
    }
    if (Date.now() - started >= maxMs) finish()
  }

  const start = () => {
    if (cancelled) return
    const el = getEl()
    if (!el) {
      timer = setTimeout(start, 50)
      return
    }
    apply()
    lastHeight = el.scrollHeight
    ro = new ResizeObserver(() => onLayout())
    ro.observe(el)
    const poll = () => {
      if (cancelled) return
      onLayout()
      if (!cancelled) timer = setTimeout(poll, 150)
    }
    timer = setTimeout(poll, 150)
  }

  timer = setTimeout(start, 50)
  return finish
}
