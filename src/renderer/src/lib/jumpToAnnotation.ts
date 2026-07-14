import { useAppStore } from '../stores/appStore'
import type {
  AnnotationAnchor,
  AnnotationHighlight,
  AnnotationStroke
} from './annotationTypes'
import { getPageBoxInScroll, getPageElement, isPageLocalAnchor } from './annotationDraw'
import { resolveHighlightRects } from './highlightRects'

function firstNormY(
  stroke?: AnnotationStroke,
  highlight?: AnnotationHighlight,
  scrollEl?: HTMLElement | null
): number | null {
  if (highlight && scrollEl) {
    const rects = resolveHighlightRects(scrollEl, highlight)
    if (rects[0]) return rects[0][1]
  }
  const fromStroke = stroke?.points?.[0]?.[1]
  if (fromStroke != null && Number.isFinite(fromStroke)) return fromStroke
  const fromHl = highlight?.rects?.[0]?.[1]
  if (fromHl != null && Number.isFinite(fromHl)) return fromHl
  return null
}

function scrollDocToNormY(scrollEl: HTMLElement, ny: number, align = 0.25): void {
  const docH = Math.max(1, scrollEl.scrollHeight)
  const target = ny * docH - scrollEl.clientHeight * align
  scrollEl.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
}

/** Jump reader to a brush stroke or text highlight. */
export function jumpToAnnotation(
  anchor: AnnotationAnchor,
  stroke?: AnnotationStroke,
  highlight?: AnnotationHighlight
): void {
  const st = useAppStore.getState()
  const scrollEl = st._readerEl
  const ny = firstNormY(stroke, highlight, scrollEl)

  // PDF / comic: page-local coords
  if (isPageLocalAnchor(anchor) && anchor.type === 'pdf-page') {
    if (scrollEl && ny != null) {
      const pageEl = getPageElement(scrollEl, anchor.pageNum)
      if (pageEl) {
        const box = getPageBoxInScroll(scrollEl, pageEl)
        const y = box.top + ny * box.height - scrollEl.clientHeight * 0.25
        scrollEl.scrollTo({ top: Math.max(0, y), behavior: 'smooth' })
        return
      }
    }
    st.setNavigateToPage(anchor.pageNum)
    return
  }

  // Continuous HTML readers: document-normalized Y is precise
  if (scrollEl && ny != null) {
    scrollDocToNormY(scrollEl, ny)
    return
  }

  // Highlight quote fallback (legacy entries without rects)
  if (scrollEl && highlight?.text?.trim()) {
    const needle = highlight.text.trim().slice(0, 64)
    if (scrollToPlainText(scrollEl, needle)) return
  }

  // Chapter start fallback
  if (scrollEl && anchor.chapterIndex != null) {
    const chapter =
      (scrollEl.querySelector(`[data-chapter="${anchor.chapterIndex}"]`) as HTMLElement | null) ||
      (scrollEl.querySelector(`[data-id="chapter-${anchor.chapterIndex}"]`) as HTMLElement | null) ||
      (scrollEl.querySelector(
        `[data-id="mobi-chapter-${anchor.chapterIndex}"]`
      ) as HTMLElement | null)
    if (chapter) {
      chapter.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
  }

  // Store signals (readers without _readerEl yet)
  if (ny != null) {
    st.setNavigateToPercent(Math.min(100, Math.max(0, ny * 100)))
  } else if (anchor.chapterIndex != null) {
    st.setNavigateToSpineIndex(anchor.chapterIndex)
  }
}

function scrollToPlainText(scrollEl: HTMLElement, needle: string): boolean {
  if (!needle) return false
  const walker = document.createTreeWalker(scrollEl, NodeFilter.SHOW_TEXT)
  let n: Node | null
  while ((n = walker.nextNode())) {
    const text = n as Text
    const idx = text.data.indexOf(needle)
    if (idx < 0) continue
    try {
      const range = document.createRange()
      range.setStart(text, idx)
      range.setEnd(text, Math.min(text.data.length, idx + needle.length))
      const rect = range.getBoundingClientRect()
      const box = scrollEl.getBoundingClientRect()
      scrollEl.scrollTop += rect.top - box.top - box.height * 0.25
      return true
    } catch {
      return false
    }
  }
  return false
}
