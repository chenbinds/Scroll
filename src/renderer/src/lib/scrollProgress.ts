/** High-precision scroll progress for continuous readers (EPUB / MOBI / TXT). */

export function getScrollableRange(el: HTMLElement): number {
  return Math.max(0, el.scrollHeight - el.clientHeight)
}

/** Progress percent with ~4 decimal places (e.g. 42.1837). */
export function readScrollPercent(el: HTMLElement): number {
  const total = getScrollableRange(el)
  if (total <= 0) return 0
  const pct = (el.scrollTop / total) * 100
  return Math.min(100, Math.max(0, Math.round(pct * 10000) / 10000))
}

export function applyScrollPercent(el: HTMLElement, percent: number): void {
  const total = getScrollableRange(el)
  if (total <= 0) return
  const ratio = Math.min(1, Math.max(0, percent / 100))
  el.scrollTop = ratio * total
}

/**
 * Restore scroll position and re-apply while layout is still settling
 * (fonts / images changing scrollHeight). Stops after stable height or timeout.
 */
export function restoreScrollPercent(
  getEl: () => HTMLElement | null,
  percent: number,
  options?: { maxMs?: number; settleMs?: number }
): () => void {
  const maxMs = options?.maxMs ?? 4000
  const settleMs = options?.settleMs ?? 400
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
    applyScrollPercent(el, percent)
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
    // Also poll briefly — some image loads don't resize the scroller itself
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
