import { useAppStore } from '../stores/appStore'
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
import { applyScrollToTextOffset } from './readingAnchor'

function scrollRangeIntoView(scrollEl: HTMLElement, range: Range, align = 0.25): void {
  try {
    const rect = range.getBoundingClientRect()
    if (rect.width > 0 || rect.height > 0) {
      const box = scrollEl.getBoundingClientRect()
      scrollEl.scrollTop += rect.top - box.top - box.height * align
      return
    }
  } catch {
    // fall through
  }
  const offsets = offsetsFromRange(scrollEl, range)
  if (offsets?.start != null) {
    applyScrollToTextOffset(scrollEl, offsets.start, align)
  }
}

function jumpToHighlight(scrollEl: HTMLElement, highlight: AnnotationHighlight): boolean {
  const range = resolveHighlightRange(scrollEl, highlight)
  if (!range) return false

  // Direct DOM scroll — do not go through navigateToTextOffset (cleared same tick / cancelled by effect cleanup)
  scrollRangeIntoView(scrollEl, range)

  const offsets = offsetsFromRange(scrollEl, range)
  if (offsets?.start != null) {
    useAppStore.getState().setReadingPosition({
      ...useAppStore.getState().readingPosition,
      textOffset: offsets.start
    })
  }
  return true
}

function scrollDocToNormY(scrollEl: HTMLElement, ny: number, align = 0.25): void {
  const docH = Math.max(1, scrollEl.scrollHeight)
  scrollEl.scrollTop = Math.max(0, ny * docH - scrollEl.clientHeight * align)
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

  if (isPageLocalAnchor(anchor) && anchor.type === 'pdf-page') {
    if (scrollEl && ny != null) {
      const pageEl = getPageElement(scrollEl, anchor.pageNum)
      if (pageEl) {
        const box = getPageBoxInScroll(scrollEl, pageEl)
        scrollEl.scrollTop = Math.max(
          0,
          box.top + ny * box.height - scrollEl.clientHeight * 0.25
        )
        return
      }
    }
    st.setNavigateToPage(anchor.pageNum)
    return
  }

  if (scrollEl && ny != null) {
    scrollDocToNormY(scrollEl, ny)
    return
  }

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
