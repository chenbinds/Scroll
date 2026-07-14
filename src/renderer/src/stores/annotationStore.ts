import { create } from 'zustand'
import {
  type AnnotationTool,
  type AnnotationStroke,
  type AnnotationHighlight,
  type BrushSettings,
  type AnnotationsFile,
  type NormRect,
  DEFAULT_BRUSH,
  DEFAULT_MARK
} from '../lib/annotationTypes'
import {
  emptyAnnotationsFile,
  loadAnnotations,
  saveAnnotations
} from '../lib/annotationStorage'

export type LeaveTarget = 'library' | 'quit'

interface AnnotationState {
  activeTool: AnnotationTool
  brush: BrushSettings
  markColor: string
  markOpacity: number
  panelOpen: boolean
  bookId: string | null
  format: AnnotationsFile['format'] | null
  strokes: AnnotationStroke[]
  highlights: AnnotationHighlight[]
  loaded: boolean
  dirty: boolean
  pendingLeave: LeaveTarget | null
  /** True while polyline/polygon click-draft is open (Esc cancels draft, not leave) */
  hasClickDraft: boolean
  /** Transient mark preview while note popup is open (create mode) */
  previewMark: { rects: NormRect[]; color: string; opacity: number } | null

  setActiveTool: (tool: AnnotationTool) => void
  setBrush: (partial: Partial<BrushSettings>) => void
  setMarkStyle: (partial: { color?: string; opacity?: number }) => void
  setPanelOpen: (open: boolean) => void
  setHasClickDraft: (open: boolean) => void
  setPreviewMark: (
    preview: { rects: NormRect[]; color: string; opacity: number } | null
  ) => void
  loadForBook: (bookId: string, format: AnnotationsFile['format']) => Promise<void>
  addStroke: (stroke: AnnotationStroke) => void
  removeStroke: (id: string) => void
  addHighlight: (hl: AnnotationHighlight) => void
  updateHighlight: (
    id: string,
    patch: Partial<
      Pick<AnnotationHighlight, 'note' | 'color' | 'opacity' | 'textStart' | 'textEnd'>
    >
  ) => void
  removeHighlight: (id: string) => void
  /** Replace in-memory annotations (e.g. import) and persist */
  replaceAllAndSave: (data: {
    strokes: AnnotationStroke[]
    highlights: AnnotationHighlight[]
  }) => Promise<boolean>
  saveNow: () => Promise<boolean>
  discardChanges: () => Promise<void>
  requestLeave: (target: LeaveTarget) => boolean
  cancelLeave: () => void
  resolveLeave: (action: 'save' | 'discard') => Promise<LeaveTarget | null>
  reset: () => void
}

export const useAnnotationStore = create<AnnotationState>((set, get) => ({
  activeTool: 'none',
  brush: { ...DEFAULT_BRUSH },
  markColor: DEFAULT_MARK.color,
  markOpacity: DEFAULT_MARK.opacity,
  panelOpen: false,
  bookId: null,
  format: null,
  strokes: [],
  highlights: [],
  loaded: false,
  dirty: false,
  pendingLeave: null,
  hasClickDraft: false,
  previewMark: null,

  setActiveTool: (tool) => {
    const current = get().activeTool
    if (tool === current) {
      set({ activeTool: 'none', panelOpen: false, hasClickDraft: false, previewMark: null })
      return
    }
    set({
      activeTool: tool,
      panelOpen: false,
      hasClickDraft: false,
      previewMark: null
    })
  },

  setBrush: (partial) =>
    set((s) => {
      const brush = { ...s.brush, ...partial }
      const shapeChanged =
        partial.shape !== undefined && partial.shape !== s.brush.shape
      return {
        brush,
        ...(shapeChanged ? { hasClickDraft: false } : {})
      }
    }),

  setMarkStyle: (partial) =>
    set((s) => ({
      markColor: partial.color ?? s.markColor,
      markOpacity: partial.opacity ?? s.markOpacity
    })),

  setPanelOpen: (open) => set({ panelOpen: open }),

  setHasClickDraft: (open) => set({ hasClickDraft: open }),

  setPreviewMark: (preview) => set({ previewMark: preview }),

  loadForBook: async (bookId, format) => {
    set({
      bookId,
      format,
      strokes: [],
      highlights: [],
      loaded: false,
      dirty: false,
      pendingLeave: null,
      hasClickDraft: false,
      previewMark: null,
      activeTool: 'none',
      panelOpen: false
    })
    try {
      const file = await loadAnnotations(bookId)
      set({
        strokes: file?.strokes ?? [],
        highlights: (file?.highlights as AnnotationHighlight[]) ?? [],
        loaded: true,
        dirty: false
      })
    } catch {
      set({ loaded: true, dirty: false })
    }
  },

  addStroke: (stroke) => {
    set((s) => ({ strokes: [...s.strokes, stroke], dirty: true }))
  },

  removeStroke: (id) => {
    set((s) => ({
      strokes: s.strokes.filter((st) => st.id !== id),
      dirty: true
    }))
  },

  addHighlight: (hl) => {
    set((s) => ({ highlights: [...s.highlights, hl], dirty: true }))
  },

  updateHighlight: (id, patch) => {
    set((s) => ({
      highlights: s.highlights.map((h) => (h.id === id ? { ...h, ...patch } : h)),
      dirty: true
    }))
  },

  removeHighlight: (id) => {
    set((s) => ({
      highlights: s.highlights.filter((h) => h.id !== id),
      dirty: true
    }))
  },

  replaceAllAndSave: async ({ strokes, highlights }) => {
    const { bookId, format } = get()
    if (!bookId || !format) return false
    set({ strokes, highlights, dirty: true })
    try {
      const file = emptyAnnotationsFile(bookId, format)
      file.strokes = strokes
      file.highlights = highlights
      await saveAnnotations(file)
      set({ dirty: false })
      return true
    } catch {
      return false
    }
  },

  saveNow: async () => {
    const { bookId, format, strokes, highlights } = get()
    if (!bookId || !format) return false
    try {
      const file = emptyAnnotationsFile(bookId, format)
      file.strokes = strokes
      file.highlights = highlights
      await saveAnnotations(file)
      set({ dirty: false })
      return true
    } catch {
      return false
    }
  },

  discardChanges: async () => {
    const { bookId, format } = get()
    if (!bookId || !format) {
      set({ strokes: [], highlights: [], dirty: false })
      return
    }
    try {
      const file = await loadAnnotations(bookId)
      set({
        strokes: file?.strokes ?? [],
        highlights: (file?.highlights as AnnotationHighlight[]) ?? [],
        dirty: false
      })
    } catch {
      set({ strokes: [], highlights: [], dirty: false })
    }
  },

  requestLeave: (target) => {
    if (!get().dirty) {
      set({ pendingLeave: null })
      return true
    }
    set({ pendingLeave: target })
    return false
  },

  cancelLeave: () => set({ pendingLeave: null }),

  resolveLeave: async (action) => {
    const target = get().pendingLeave
    if (!target) return null
    if (action === 'save') {
      const ok = await get().saveNow()
      if (!ok) return null
    } else {
      await get().discardChanges()
    }
    set({ pendingLeave: null })
    return target
  },

  reset: () => {
    set({
      activeTool: 'none',
      panelOpen: false,
      bookId: null,
      format: null,
      strokes: [],
      highlights: [],
      loaded: false,
      dirty: false,
      pendingLeave: null,
      hasClickDraft: false,
      previewMark: null,
      brush: { ...DEFAULT_BRUSH },
      markColor: DEFAULT_MARK.color,
      markOpacity: DEFAULT_MARK.opacity
    })
  }
}))
