export type AnnotationTool = 'none' | 'mark' | 'brush' | 'eraser'

export type BrushShape =
  | 'curve'
  | 'line'
  | 'polyline'
  | 'arrow'
  | 'rect'
  | 'circle'
  | 'star'
  | 'polygon'

export interface BrushSettings {
  shape: BrushShape
  color: string
  opacity: number
  lineWidth: number
}

/** Location hint for jump / future sidebar — coordinates stay document-normalized */
export type AnnotationAnchor =
  | { type: 'document'; chapterHref?: string; chapterIndex?: number }
  | { type: 'pdf-page'; pageNum: number }

/** @deprecated alias — prefer AnnotationAnchor */
export type EpubAnchor = AnnotationAnchor

export interface AnnotationStroke {
  id: string
  tool: 'brush'
  shape: BrushShape
  points: [number, number][]
  color: string
  opacity: number
  lineWidth: number
  anchor: AnnotationAnchor
  createdAt: number
}

/** Normalized document rect [x, y, w, h] in 0–1 */
export type NormRect = [number, number, number, number]

export interface AnnotationHighlight {
  id: string
  tool: 'mark'
  color: string
  opacity: number
  rects: NormRect[]
  /** Selected quote (snippet) */
  text?: string
  /** User note attached to this mark */
  note?: string
  anchor: AnnotationAnchor
  createdAt: number
}

export interface AnnotationsFile {
  version: 1
  bookId: string
  format: 'epub' | 'mobi' | 'txt' | 'pdf' | 'comic'
  updatedAt: number
  strokes: AnnotationStroke[]
  highlights: AnnotationHighlight[]
}

/** Map library book.format → annotations file format (AZW/AZW3 → mobi) */
export function annotationFormatForBook(bookFormat: string): AnnotationsFile['format'] {
  const f = bookFormat.toUpperCase()
  if (f === 'EPUB') return 'epub'
  if (f === 'MOBI' || f === 'AZW' || f === 'AZW3') return 'mobi'
  if (f === 'PDF') return 'pdf'
  if (f === 'TXT' || f === 'MD' || f === 'MARKDOWN') return 'txt'
  if (f === 'CBZ' || f === 'CBR') return 'comic'
  return 'epub'
}

/** Mark (text selection) works on HTML readers only — not PDF/comic canvases */
export function markToolSupported(format: AnnotationsFile['format'] | null): boolean {
  return format === 'epub' || format === 'mobi' || format === 'txt'
}

export const ANNOTATION_COLORS = [
  '#E53935',
  '#FF9800',
  '#FFEB3B',
  '#4CAF50',
  '#2196F3',
  '#9C27B0',
  '#795548',
  '#607D8B',
  '#000000',
  '#FFFFFF',
  '#FF4081',
  '#00BCD4'
] as const

export const DEFAULT_BRUSH: BrushSettings = {
  shape: 'curve',
  color: ANNOTATION_COLORS[0],
  opacity: 80,
  lineWidth: 2
}

export const DEFAULT_MARK = {
  color: ANNOTATION_COLORS[0],
  opacity: 45
}

export const BRUSH_SHAPES: { shape: BrushShape; labelKey: string }[] = [
  { shape: 'curve', labelKey: 'annotation.shape.curve' },
  { shape: 'line', labelKey: 'annotation.shape.line' },
  { shape: 'polyline', labelKey: 'annotation.shape.polyline' },
  { shape: 'arrow', labelKey: 'annotation.shape.arrow' },
  { shape: 'rect', labelKey: 'annotation.shape.rect' },
  { shape: 'circle', labelKey: 'annotation.shape.circle' },
  { shape: 'star', labelKey: 'annotation.shape.star' },
  { shape: 'polygon', labelKey: 'annotation.shape.polygon' }
]
