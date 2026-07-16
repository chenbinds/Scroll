/** In-book full-text search for continuous scroll readers (EPUB / TXT / MOBI). */

export interface SearchTitleAnchor {
  title: string
  /** Offset into chapter plainText — section starts here */
  offset: number
}

export interface SearchChapter {
  chapterIndex: number
  /** Fallback label when no anchors match */
  title?: string
  plainText: string
  /** In-file section starts (TOC fragments / headings), sorted by offset */
  titleAnchors?: SearchTitleAnchor[]
}

export interface SearchHit {
  chapterIndex: number
  /** Offsets into that chapter's plainText (text node concatenation) */
  start: number
  end: number
  snippet: string
  chapterTitle?: string
}

export const SEARCH_HIT_LIMIT = 200

export interface TocLike {
  label: string
  href: string
  spineIndex: number
  subitems?: TocLike[]
}

/** Flatten nested TOC. */
export function flattenToc(toc: TocLike[]): TocLike[] {
  const out: TocLike[] = []
  const walk = (items: TocLike[]) => {
    for (const it of items) {
      out.push(it)
      if (it.subitems?.length) walk(it.subitems)
    }
  }
  walk(toc)
  return out
}

export function fragmentFromHref(href: string): string | null {
  const i = href.indexOf('#')
  if (i < 0 || i === href.length - 1) return null
  try {
    return decodeURIComponent(href.slice(i + 1))
  } catch {
    return href.slice(i + 1)
  }
}

/** HTML → plain text matching browser textContent (for index offsets). */
export function stripHtmlToPlain(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
    return doc.body?.textContent ?? ''
  } catch {
    return html.replace(/<[^>]+>/g, '')
  }
}

function textOffsetOfElement(root: HTMLElement, target: Element): number {
  // Match stripHtmlToPlain / textContent: sum of text nodes before target
  const doc = root.ownerDocument
  if (!doc) return 0
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let offset = 0
  let node: Node | null
  while ((node = walker.nextNode())) {
    if (target.contains(node)) return offset
    offset += (node as Text).data.length
  }
  return offset
}

/**
 * Section titles inside one spine HTML.
 * - Headings (h1–h6) mark where a section starts (offset into plainText).
 * - `carryInTitle` labels content BEFORE the first heading (previous chapter carry-over).
 * Never assign a later heading’s title to earlier body text.
 */
export function buildTitleAnchors(
  html: string,
  options?: {
    tocForSpine?: { label: string; href: string }[]
    carryInTitle?: string
  }
): SearchTitleAnchor[] {
  let body: HTMLElement
  try {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
    body = doc.body
    if (!body) return []
  } catch {
    return []
  }

  const anchors: SearchTitleAnchor[] = []
  const byOffset = new Map<number, string>()

  const setAt = (offset: number, title: string) => {
    const o = Math.max(0, offset)
    const t = title.replace(/\s+/g, ' ').trim()
    if (!t) return
    // Prefer first title at same offset (heading usually registered first)
    if (!byOffset.has(o)) byOffset.set(o, t)
  }

  // 1) Headings = authoritative section boundaries
  body.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
    const title = (h.textContent || '').replace(/\s+/g, ' ').trim()
    if (!title) return
    setAt(textOffsetOfElement(body, h), title)
  })

  // 2) TOC fragments that resolve inside the file (may add more anchors)
  for (const entry of options?.tocForSpine ?? []) {
    const frag = fragmentFromHref(entry.href)
    if (!frag) continue
    let el: Element | null = null
    try {
      el =
        body.querySelector(`#${CSS.escape(frag)}`) ||
        body.querySelector(`[name="${CSS.escape(frag)}"]`) ||
        body.querySelector(`a[id="${CSS.escape(frag)}"]`)
    } catch {
      el = null
    }
    if (el) setAt(textOffsetOfElement(body, el), entry.label)
  }

  const sorted = [...byOffset.entries()]
    .map(([offset, title]) => ({ offset, title }))
    .sort((a, b) => a.offset - b.offset)

  // 3) Preamble before first heading → previous chapter title (never the upcoming heading)
  const carry = options?.carryInTitle?.trim()
  if (carry) {
    const firstOff = sorted[0]?.offset ?? Infinity
    if (firstOff > 0) {
      sorted.unshift({ title: carry, offset: 0 })
    }
  } else {
    // No carry-in: only claim offset 0 if a TOC entry has no fragment (whole-file chapter)
    const whole = options?.tocForSpine?.find((t) => !fragmentFromHref(t.href))
    if (whole && (sorted.length === 0 || sorted[0].offset > 0)) {
      sorted.unshift({ title: whole.label, offset: 0 })
    }
  }

  return sorted
}

/** Nearest preceding section title at plainText offset. */
export function titleAtOffset(
  offset: number,
  anchors: SearchTitleAnchor[] | undefined,
  fallback?: string
): string | undefined {
  if (!anchors || anchors.length === 0) return fallback
  let title: string | undefined
  for (const a of anchors) {
    if (a.offset <= offset) title = a.title
    else break
  }
  // Hit before every anchor (shouldn't happen if offset 0 exists)
  return title ?? fallback ?? anchors[0]?.title
}

export function searchChapters(
  chapters: SearchChapter[],
  query: string,
  limit = SEARCH_HIT_LIMIT
): SearchHit[] {
  const q = query.trim()
  if (!q || chapters.length === 0) return []

  const needle = q.toLocaleLowerCase()
  const needleLen = needle.length
  const hits: SearchHit[] = []

  for (const ch of chapters) {
    const hay = ch.plainText
    if (!hay) continue
    const lower = hay.toLocaleLowerCase()
    let from = 0
    while (from < lower.length) {
      const idx = lower.indexOf(needle, from)
      if (idx < 0) break
      const start = idx
      const end = idx + needleLen
      const snippetPad = 36
      const snStart = Math.max(0, start - snippetPad)
      const snEnd = Math.min(hay.length, end + snippetPad)
      let snippet = hay.slice(snStart, snEnd).replace(/\s+/g, ' ').trim()
      if (snStart > 0) snippet = '…' + snippet
      if (snEnd < hay.length) snippet = snippet + '…'
      hits.push({
        chapterIndex: ch.chapterIndex,
        start,
        end,
        snippet,
        chapterTitle: titleAtOffset(start, ch.titleAnchors, ch.title)
      })
      if (hits.length >= limit) return hits
      from = idx + Math.max(1, needleLen)
    }
  }
  return hits
}

/** Map plainText offsets within root to a DOM Range (text-node walk). */
export function rangeFromTextOffsets(
  root: HTMLElement,
  start: number,
  end: number
): Range | null {
  if (end <= start) return null
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let pos = 0
  let startNode: Text | null = null
  let startOffset = 0
  let endNode: Text | null = null
  let endOffset = 0

  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = node as Text
    const len = text.data.length
    if (!startNode && pos + len > start) {
      startNode = text
      startOffset = start - pos
    }
    if (startNode && pos + len >= end) {
      endNode = text
      endOffset = end - pos
      break
    }
    pos += len
  }

  if (!startNode || !endNode) return null
  try {
    const range = document.createRange()
    range.setStart(startNode, Math.max(0, Math.min(startOffset, startNode.data.length)))
    range.setEnd(endNode, Math.max(0, Math.min(endOffset, endNode.data.length)))
    return range
  } catch {
    return null
  }
}

const HIGHLIGHT_NAME = 'scroll-search'

export function applySearchHighlight(range: Range): void {
  try {
    const CSSObj = (window as unknown as { CSS?: { highlights?: Map<string, unknown> } }).CSS
    if (!CSSObj?.highlights || typeof Highlight === 'undefined') return
    CSSObj.highlights.set(HIGHLIGHT_NAME, new Highlight(range))
  } catch {
    // unsupported
  }
}

export function clearSearchHighlight(): void {
  try {
    const CSSObj = (window as unknown as { CSS?: { highlights?: Map<string, unknown> } }).CSS
    CSSObj?.highlights?.delete(HIGHLIGHT_NAME)
  } catch {
    // ignore
  }
}

/** Run work in idle slices so cold-start UI stays responsive. */
export function runIdleSlices(
  work: () => boolean,
  options?: { sliceMs?: number; timeout?: number }
): () => void {
  const sliceMs = options?.sliceMs ?? 6
  const timeout = options?.timeout ?? 200
  let cancelled = false
  let idleId = 0
  let timerId = 0

  const schedule = (cb: () => void) => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (w.requestIdleCallback) {
      idleId = w.requestIdleCallback(() => { cb() }, { timeout })
    } else {
      timerId = window.setTimeout(cb, 16)
    }
  }

  const tick = () => {
    if (cancelled) return
    const start = performance.now()
    let more = true
    while (more && performance.now() - start < sliceMs) {
      more = work()
    }
    if (more && !cancelled) schedule(tick)
  }

  schedule(tick)

  return () => {
    cancelled = true
    const w = window as Window & { cancelIdleCallback?: (id: number) => void }
    if (idleId) w.cancelIdleCallback?.(idleId)
    if (timerId) clearTimeout(timerId)
  }
}

/**
 * Build search chapters one-by-one on the idle queue.
 * `buildOne(index, carryInTitle)` returns the chapter plus next carry title.
 */
export function buildSearchChaptersIdle(
  count: number,
  buildOne: (
    index: number,
    carryInTitle: string
  ) => { chapter: SearchChapter; nextCarry: string },
  onDone: (chapters: SearchChapter[]) => void
): () => void {
  const out: SearchChapter[] = []
  let i = 0
  let carry = ''
  let finished = false
  return runIdleSlices(() => {
    if (finished) return false
    if (count === 0) {
      finished = true
      onDone(out)
      return false
    }
    const { chapter, nextCarry } = buildOne(i, carry)
    out.push(chapter)
    carry = nextCarry
    i += 1
    if (i >= count) {
      finished = true
      onDone(out)
      return false
    }
    return true
  })
}

export function jumpToSearchHit(
  scrollEl: HTMLElement,
  hit: SearchHit
): boolean {
  const section =
    (scrollEl.querySelector(`[data-chapter="${hit.chapterIndex}"]`) as HTMLElement | null) ||
    (scrollEl.querySelector(`[data-id="chapter-${hit.chapterIndex}"]`) as HTMLElement | null) ||
    (scrollEl.querySelector(`[data-id="mobi-chapter-${hit.chapterIndex}"]`) as HTMLElement | null)

  if (!section) return false

  const range = rangeFromTextOffsets(section, hit.start, hit.end)
  if (!range) {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    clearSearchHighlight()
    return true
  }

  applySearchHighlight(range)

  const scrollRect = scrollEl.getBoundingClientRect()
  const rangeRect = range.getBoundingClientRect()
  if (rangeRect.width > 0 || rangeRect.height > 0) {
    const delta = rangeRect.top - scrollRect.top - scrollEl.clientHeight * 0.35
    scrollEl.scrollBy({ top: delta, behavior: 'smooth' })
  } else {
    section.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  return true
}
