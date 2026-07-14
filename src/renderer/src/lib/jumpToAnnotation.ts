import { useAppStore } from '../stores/appStore'
import { useAnnotationStore } from '../stores/annotationStore'
import type {
  AnnotationAnchor,
  AnnotationHighlight,
  AnnotationStroke
} from './annotationTypes'
import { getPageBoxInScroll, getPageElement, isPageLocalAnchor } from './annotationDraw'
import {
  offsetsFromRange,
  resolveHighlightRange
} from './highlightRects'
import { restoreScrollByTextOffset } from './readingAnchor'

function scrollRangeIntoView(scrollEl: HTMLElement, range: Range, align = 0.25): void {
  const rect = range.getBoundingClientRect()
  if (rect.width > 0 || rect.height > 0) {
    const box = scrollEl.getBoundingClientRect()
    scrollEl.scrollTo({
      top: scrollEl.scrollTop + (rect.top - box.top) - box.height * align,
      behavior: 'smooth'
    })
    return
  }
  const offsets = offsetsFromRange(scrollEl, range)
  if (offsets?.start != null) {
    restoreScrollByTextOffset(() => scrollEl, offsets.start, { maxMs: 1500 })
  }
}

function jumpToHighlight(scrollEl: HTMLElement, highlight: AnnotationHighlight): boolean {
  const range = resolveHighlightRange(scrollEl, highlight)
  if (!range) return false

  const offsets = offsetsFromRange(scrollEl, range)
  const st = useAppStore.getState()

  if (offsets?.start != null) {
    // Same path as bookmarks — stable at any font size
    st.setNavigateToTextOffset(offsets.start)

    // Backfill offsets for legacy marks (no textStart yet)
    if (highlight.textStart == null && highlight.textEnd == null) {
      useAnnotationStore.getState().updateHighlight(highlight.id, {
        textStart: offsets.start,
        textEnd: offsets.end
      })
    }
    return true
  }

  scrollRangeIntoView(scrollEl, range)
  return true
}

/** Jump reader to a brush stroke or text highlight. */
export function jumpToAnnotation(
  anchor: AnnotationAnchor,
  stroke?: AnnotationStroke,
  highlight?: AnnotationHighlight
): void {
  const st = useAppStore.getState()
  const scrollEl = st._readerEl

  if (highlight && scrollEl && jumpToHighlight(scrollEl, highlight)) {
    return
  }

  const fromStroke = stroke?.points?.[0]?.[1]
  const fromHl = highlight?.rects?.[0]?.[1]
  const ny =
    fromStroke != null && Number.isFinite(fromStroke)
      ? fromStroke
      : fromHl != null && Number.isFinite(fromHl)
        ? fromHl
        : null

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

  // Brush strokes: normalized document Y (best effort)
  if (scrollEl && ny != null) {
    const docH = Math.max(1, scrollEl.scrollHeight)
    const target = ny * docH - scrollEl.clientHeight * 0.25
    scrollEl.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
    return
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

  if (ny != null) {
    st.setNavigateToPercent(Math.min(100, Math.max(0, ny * 100)))
  } else if (anchor.chapterIndex != null) {
    st.setNavigateToSpineIndex(anchor.chapterIndex)
  }
}
