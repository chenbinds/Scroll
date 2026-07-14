/** In-book full-text search for continuous scroll readers (EPUB / TXT / MOBI). */

export interface SearchChapter {
  chapterIndex: number
  title?: string
  plainText: string
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

/** HTML → plain text matching browser textContent (for index offsets). */
export function stripHtmlToPlain(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
    return doc.body?.textContent ?? ''
  } catch {
    return html.replace(/<[^>]+>/g, '')
  }
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
        chapterTitle: ch.title
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
