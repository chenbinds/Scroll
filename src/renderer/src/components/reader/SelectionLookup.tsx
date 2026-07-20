import { useCallback, useEffect, useRef, useState } from 'react'
import { BookOpen, Loader2, X } from 'lucide-react'
import { useAnnotationStore } from '../../stores/annotationStore'
import { useAppStore } from '../../stores/appStore'
import { useI18n } from '../../lib/i18n'
import { explain } from '../../lib/aiService'

interface Props {
  scrollRef: React.RefObject<HTMLDivElement | null>
}

const MAX_TERM = 2000

export default function SelectionLookup({ scrollRef }: Props) {
  const { t } = useI18n()
  const activeTool = useAnnotationStore((s) => s.activeTool)
  const aiConfig = useAppStore((s) => s.aiConfig)

  const [sel, setSel] = useState<{
    text: string
    left: number
    top: number
  } | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const seqRef = useRef(0)

  const clear = useCallback(() => {
    setSel(null)
    setOpen(false)
    setLoading(false)
    setResult(null)
    setError(null)
  }, [])

  useEffect(() => {
    if (activeTool !== 'none') clear()
  }, [activeTool, clear])

  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return

    const onMouseUp = () => {
      if (useAnnotationStore.getState().activeTool !== 'none') return
      requestAnimationFrame(() => {
        const selection = window.getSelection()
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
          // Keep panel if already explaining
          if (!open && !loading) setSel(null)
          return
        }
        const range = selection.getRangeAt(0)
        if (!scrollEl.contains(range.commonAncestorContainer)) return
        const text = selection.toString().replace(/\s+/g, ' ').trim()
        if (!text || text.length > MAX_TERM) {
          if (!open) setSel(null)
          return
        }
        const rect = range.getBoundingClientRect()
        const left = Math.min(
          window.innerWidth - 88,
          Math.max(8, rect.left + rect.width / 2 - 36)
        )
        const top = Math.max(8, rect.top - 36)
        setSel({ text, left, top })
        setOpen(false)
        setResult(null)
        setError(null)
      })
    }

    const onScroll = () => {
      if (!open && !loading) setSel(null)
    }

    scrollEl.addEventListener('mouseup', onMouseUp)
    scrollEl.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      scrollEl.removeEventListener('mouseup', onMouseUp)
      scrollEl.removeEventListener('scroll', onScroll)
    }
  }, [scrollRef, open, loading])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return
      clear()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clear()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, clear])

  const runLookup = async () => {
    if (!sel) return
    const configured = !!(aiConfig.baseUrl && aiConfig.apiKey && aiConfig.model)
    if (!configured) {
      setOpen(true)
      setError(t('lookup.notConfigured'))
      return
    }

    const term = sel.text
    const chapter = useAppStore.getState().aiContext.content || ''
    setOpen(true)
    setLoading(true)
    setResult(null)
    setError(null)
    const seq = ++seqRef.current

    try {
      const answer = await explain(term, chapter, {
        baseUrl: aiConfig.baseUrl,
        apiKey: aiConfig.apiKey,
        model: aiConfig.model,
        maxTokens: Math.min(aiConfig.maxTokens || 512, 512)
      })
      if (seq !== seqRef.current) return
      setResult(answer.trim())
    } catch (e) {
      if (seq !== seqRef.current) return
      setError(e instanceof Error ? e.message : t('lookup.failed'))
    } finally {
      if (seq === seqRef.current) setLoading(false)
    }
  }

  if (!sel) return null

  return (
    <>
      {!open && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void runLookup()}
          className="fixed z-[55] flex items-center gap-1 px-2 py-1 text-xs rounded-md shadow
                     chrome-surface-raised border border-[var(--reader-border)]
                     hover:opacity-90"
          style={{ left: sel.left, top: sel.top }}
        >
          <BookOpen size={12} />
          {t('lookup.action')}
        </button>
      )}

      {open && (
        <div
          ref={panelRef}
          className="fixed z-[56] w-[280px] max-h-[240px] overflow-auto rounded-lg shadow-lg
                     chrome-surface-raised border border-[var(--reader-border)] p-3"
          style={{
            left: Math.min(sel.left, window.innerWidth - 296),
            top: Math.min(sel.top + 28, window.innerHeight - 120)
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <p className="text-xs font-medium line-clamp-2 flex-1">「{sel.text}」</p>
            <button type="button" onClick={clear} className="p-0.5 chrome-muted shrink-0" aria-label={t('annotation.close')}>
              <X size={12} />
            </button>
          </div>
          {loading && (
            <p className="text-xs chrome-muted flex items-center gap-1.5 py-2">
              <Loader2 size={12} className="animate-spin" />
              {t('lookup.loading')}
            </p>
          )}
          {error && <p className="text-xs text-red-500 whitespace-pre-wrap">{error}</p>}
          {result && !loading && (
            <p className="text-xs leading-relaxed whitespace-pre-wrap">{result}</p>
          )}
        </div>
      )}
    </>
  )
}
