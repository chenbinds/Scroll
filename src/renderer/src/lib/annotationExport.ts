import type { Bookmark } from '../stores/appStore'
import type {
  AnnotationHighlight,
  AnnotationStroke,
  AnnotationsFile
} from './annotationTypes'

export const SCROLL_EXPORT_KIND = 'scroll-annotations' as const

export interface ScrollExportBundle {
  version: 1
  kind: typeof SCROLL_EXPORT_KIND
  exportedAt: number
  book: {
    title: string
    author?: string
    format: string
  }
  annotations: AnnotationsFile
  bookmarks?: Bookmark[]
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function escapeMd(text: string): string {
  return text.replace(/\r\n/g, '\n').trim()
}

function locationLabel(anchor: AnnotationHighlight['anchor'] | AnnotationStroke['anchor']): string {
  if (anchor.type === 'pdf-page') return `第 ${anchor.pageNum} 页`
  if (anchor.chapterIndex != null) return `第 ${anchor.chapterIndex + 1} 章`
  return ''
}

function safeFileStem(title: string): string {
  const base = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim()
  return (base || 'annotations').slice(0, 80)
}

export function defaultExportFileName(bookTitle: string): string {
  return `${safeFileStem(bookTitle)}-标注.md`
}

export function buildExportBundle(input: {
  book: { id: string; title: string; author?: string; format: string }
  format: AnnotationsFile['format']
  highlights: AnnotationHighlight[]
  strokes: AnnotationStroke[]
  bookmarks?: Bookmark[]
}): ScrollExportBundle {
  const annotations: AnnotationsFile = {
    version: 1,
    bookId: input.book.id,
    format: input.format,
    updatedAt: Date.now(),
    strokes: input.strokes,
    highlights: input.highlights
  }
  return {
    version: 1,
    kind: SCROLL_EXPORT_KIND,
    exportedAt: Date.now(),
    book: {
      title: input.book.title,
      author: input.book.author,
      format: input.book.format
    },
    annotations,
    bookmarks: input.bookmarks?.length ? input.bookmarks : undefined
  }
}

/** Human-readable Markdown + machine block for re-import. */
export function buildAnnotationsMarkdown(bundle: ScrollExportBundle): string {
  const lines: string[] = []
  const { book, annotations, bookmarks } = bundle
  const highlights = [...annotations.highlights].sort((a, b) => a.createdAt - b.createdAt)
  const strokes = [...annotations.strokes].sort((a, b) => a.createdAt - b.createdAt)

  lines.push(`# 《${book.title}》标注导出`)
  lines.push('')
  if (book.author) lines.push(`- 作者：${book.author}`)
  lines.push(`- 格式：${book.format}`)
  lines.push(`- 导出时间：${formatTime(bundle.exportedAt)}`)
  lines.push(`- 高亮 ${highlights.length} · 画笔 ${strokes.length}`)
  if (bookmarks?.length) lines.push(`- 位置书签 ${bookmarks.length}`)
  lines.push('')

  lines.push('## 高亮与笔记')
  lines.push('')
  if (highlights.length === 0) {
    lines.push('_（无）_')
    lines.push('')
  } else {
    highlights.forEach((hl, i) => {
      lines.push(`### ${i + 1}. ${formatTime(hl.createdAt)}`)
      lines.push('')
      const quote = escapeMd(hl.text || '')
      if (quote) {
        for (const row of quote.split('\n')) {
          lines.push(`> ${row}`)
        }
        lines.push('')
      } else {
        lines.push('_（无摘录原文）_')
        lines.push('')
      }
      const note = escapeMd(hl.note || '')
      if (note) {
        lines.push(`**笔记：** ${note}`)
        lines.push('')
      }
      const loc = locationLabel(hl.anchor)
      if (loc) {
        lines.push(`位置：${loc}`)
        lines.push('')
      }
    })
  }

  lines.push('## 画笔标注')
  lines.push('')
  if (strokes.length === 0) {
    lines.push('_（无）_')
    lines.push('')
  } else {
    for (const st of strokes) {
      const loc = locationLabel(st.anchor)
      const bits = [formatTime(st.createdAt), st.shape]
      if (loc) bits.push(loc)
      lines.push(`- ${bits.join(' · ')}`)
    }
    lines.push('')
  }

  if (bookmarks && bookmarks.length > 0) {
    lines.push('## 位置书签')
    lines.push('')
    for (const bm of bookmarks) {
      const extra =
        bm.percent != null ? `${bm.percent}%` : bm.page != null ? `p.${bm.page}` : ''
      lines.push(`- ${bm.label}${extra ? `（${extra}）` : ''} · ${formatTime(bm.time)}`)
    }
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push('_文末数据块供卷轴重新导入，可忽略。_')
  lines.push('')
  lines.push(`<!-- scroll-annotations:v1`)
  lines.push(JSON.stringify(bundle))
  lines.push(`-->`)
  lines.push('')

  return lines.join('\n')
}

function isAnnotationsFile(v: unknown): v is AnnotationsFile {
  if (!v || typeof v !== 'object') return false
  const o = v as AnnotationsFile
  return (
    o.version === 1 &&
    typeof o.bookId === 'string' &&
    Array.isArray(o.strokes) &&
    Array.isArray(o.highlights)
  )
}

function isBundle(v: unknown): v is ScrollExportBundle {
  if (!v || typeof v !== 'object') return false
  const o = v as ScrollExportBundle
  return o.version === 1 && o.kind === SCROLL_EXPORT_KIND && isAnnotationsFile(o.annotations)
}

/** Parse exported .md (with data block) or raw .json. */
export function parseAnnotationsImport(raw: string): ScrollExportBundle | null {
  const text = raw.replace(/^\uFEFF/, '').trim()
  if (!text) return null

  // Prefer HTML comment block in Markdown
  const blockMatch = text.match(/<!--\s*scroll-annotations:v1\s*([\s\S]*?)-->/)
  if (blockMatch?.[1]) {
    try {
      const parsed = JSON.parse(blockMatch[1].trim()) as unknown
      if (isBundle(parsed)) return parsed
      if (isAnnotationsFile(parsed)) {
        return {
          version: 1,
          kind: SCROLL_EXPORT_KIND,
          exportedAt: Date.now(),
          book: { title: '', format: parsed.format },
          annotations: parsed
        }
      }
    } catch {
      // fall through
    }
  }

  // Raw JSON file
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text) as unknown
      if (isBundle(parsed)) return parsed
      if (isAnnotationsFile(parsed)) {
        return {
          version: 1,
          kind: SCROLL_EXPORT_KIND,
          exportedAt: Date.now(),
          book: { title: '', format: parsed.format },
          annotations: parsed
        }
      }
    } catch {
      return null
    }
  }

  return null
}
