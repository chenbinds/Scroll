import { X, BookmarkPlus, Highlighter, PenLine } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useAnnotationStore } from '../../stores/annotationStore'
import { useI18n } from '../../lib/i18n'
import type { AnnotationAnchor, AnnotationHighlight, AnnotationStroke } from '../../lib/annotationTypes'

function jumpToAnchor(
  anchor: AnnotationAnchor,
  stroke?: AnnotationStroke,
  highlight?: AnnotationHighlight
): void {
  const st = useAppStore.getState()
  if (anchor.type === 'pdf-page') {
    st.setNavigateToPage(anchor.pageNum)
    return
  }
  if (anchor.chapterIndex != null) {
    st.setNavigateToSpineIndex(anchor.chapterIndex)
    return
  }
  const y =
    stroke?.points[0]?.[1] ??
    highlight?.rects[0]?.[1]
  if (y != null) {
    st.setNavigateToPercent(Math.round(y * 100))
  }
}

export default function BookmarkPanel() {
  const { t } = useI18n()
  const {
    bookmarks,
    addBookmark,
    removeBookmark,
    readingPosition,
    setNavigateToPercent,
    setNavigateToPage,
    currentBook
  } = useAppStore()
  const strokes = useAnnotationStore((s) => s.strokes)
  const highlights = useAnnotationStore((s) => s.highlights)
  const loaded = useAnnotationStore((s) => s.loaded)

  const handleAdd = () => {
    const now = new Date()
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    const label = `${timeStr} - ${readingPosition.percent}%`
    addBookmark({
      label,
      percent: readingPosition.percent,
      page: readingPosition.page,
      time: Date.now()
    })
  }

  const handleNavigateBookmark = (percent?: number, page?: number) => {
    if (page != null) setNavigateToPage(page)
    else if (percent !== undefined) setNavigateToPercent(percent)
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  const annotationLabel = (stroke: AnnotationStroke) => {
    if (stroke.anchor.type === 'pdf-page') return `${t('bookmarks.page')} ${stroke.anchor.pageNum}`
    if (stroke.anchor.chapterIndex != null) return `${t('bookmarks.chapter')} ${stroke.anchor.chapterIndex + 1}`
    return t('bookmarks.brushStroke')
  }

  const highlightLabel = (hl: AnnotationHighlight) => {
    const snippet = hl.text?.slice(0, 24) || hl.note?.slice(0, 24)
    return snippet ? `"${snippet}${(hl.text?.length ?? hl.note?.length ?? 0) > 24 ? '…' : ''}"` : t('bookmarks.highlight')
  }

  const askAiAbout = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    useAppStore.getState().setAiContext({ selection: trimmed.slice(0, 3000) })
    useAppStore.getState().setAiDraft(`${t('ai.askAboutSelection')}\n「${trimmed.slice(0, 200)}${trimmed.length > 200 ? '…' : ''}」\n\n`)
    useAppStore.getState().setRequestAiPanel(true)
  }

  const hasAnnotations = loaded && (strokes.length > 0 || highlights.length > 0)

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200 dark:border-gray-800">
        <button onClick={handleAdd}
          className="w-full py-2 text-sm text-scroll-600 dark:text-scroll-400
                     border border-dashed border-scroll-300 dark:border-scroll-700
                     rounded-lg hover:bg-scroll-50 dark:hover:bg-scroll-900/20
                     transition-colors flex items-center justify-center gap-1.5">
          <BookmarkPlus size={14} />
          {t('bookmarks.addPosition')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {bookmarks.length > 0 && (
          <div className="px-3 pt-2 pb-1">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-600">
              {t('bookmarks.positions')}
            </p>
          </div>
        )}
        {bookmarks.length === 0 && !hasAnnotations && (
          <div className="p-4 text-center text-sm text-gray-400 dark:text-gray-600">
            <p>{t('bookmarks.empty')}</p>
          </div>
        )}
        {bookmarks.map((bm, i) => (
          <div key={`bm-${i}`}
            onClick={() => handleNavigateBookmark(bm.percent, bm.page)}
            className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-gray-800/50
                       hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors group cursor-pointer">
            <BookmarkPlus size={14} className="text-scroll-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{bm.label}</p>
              <p className="text-xs text-gray-400 dark:text-gray-600">
                {bm.percent !== undefined ? `${bm.percent}%` : bm.page ? `${t('bookmarks.page')} ${bm.page}` : ''}
                {' · '}{formatTime(bm.time)}
              </p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); removeBookmark(i) }}
              className="p-0.5 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
              <X size={14} />
            </button>
          </div>
        ))}

        {hasAnnotations && (
          <>
            <div className="px-3 pt-3 pb-1 border-t border-gray-100 dark:border-gray-800/50 mt-1">
              <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-600">
                {t('bookmarks.annotations')} {currentBook ? '' : ''}
              </p>
            </div>
            {highlights.map((hl) => (
              <div key={hl.id}
                className="flex items-start gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800/50
                           hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors group">
                <Highlighter size={14} className="text-yellow-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => jumpToAnchor(hl.anchor, undefined, hl)}>
                  <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{highlightLabel(hl)}</p>
                  {hl.note && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{hl.note}</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-0.5">{formatTime(hl.createdAt)}</p>
                </div>
                {(hl.text || hl.note) && (
                  <button
                    type="button"
                    onClick={() => askAiAbout(hl.note || hl.text || '')}
                    className="text-[10px] text-scroll-500 hover:underline opacity-0 group-hover:opacity-100 shrink-0"
                  >
                    AI
                  </button>
                )}
              </div>
            ))}
            {strokes.map((st) => (
              <div key={st.id}
                onClick={() => jumpToAnchor(st.anchor, st)}
                className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800/50
                           hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer group">
                <PenLine size={14} className="shrink-0" style={{ color: st.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{annotationLabel(st)}</p>
                  <p className="text-[10px] text-gray-400">{formatTime(st.createdAt)}</p>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
