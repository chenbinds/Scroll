import { useEffect, useRef, useState } from 'react'
import { AlignLeft, Maximize2, Minimize2, Type } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useI18n } from '../../lib/i18n'

const LINE_OPTIONS = [1.4, 1.6, 1.85, 2.1, 2.4]
const PARA_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0]
const MARGIN_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5]

function nearest(value: number, options: number[]): number {
  let best = options[0]
  let dist = Math.abs(value - best)
  for (const o of options) {
    const d = Math.abs(value - o)
    if (d < dist) {
      dist = d
      best = o
    }
  }
  return best
}

export default function TypographyPanel() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const readingLineHeight = useAppStore((s) => s.readingLineHeight)
  const setReadingLineHeight = useAppStore((s) => s.setReadingLineHeight)
  const readingParagraphGap = useAppStore((s) => s.readingParagraphGap)
  const setReadingParagraphGap = useAppStore((s) => s.setReadingParagraphGap)
  const readingPageMargin = useAppStore((s) => s.readingPageMargin)
  const setReadingPageMargin = useAppStore((s) => s.setReadingPageMargin)
  const readerImmersive = useAppStore((s) => s.readerImmersive)
  const toggleReaderImmersive = useAppStore((s) => s.toggleReaderImmersive)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const line = nearest(readingLineHeight, LINE_OPTIONS)
  const para = nearest(readingParagraphGap, PARA_OPTIONS)
  const margin = nearest(readingPageMargin, MARGIN_OPTIONS)

  return (
    <div ref={rootRef} className="relative flex items-center gap-0.5">
      <button
        type="button"
        title={t('reader.typography')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="p-1 chrome-muted hover:opacity-80 transition-colors rounded
                   border border-transparent hover:border-[var(--reader-border)]"
      >
        <Type size={15} />
      </button>
      <button
        type="button"
        title={readerImmersive ? t('reader.exitImmersive') : t('reader.immersive')}
        onClick={() => toggleReaderImmersive()}
        className="p-1 chrome-muted hover:opacity-80 transition-colors rounded
                   border border-transparent hover:border-[var(--reader-border)]"
      >
        {readerImmersive ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 w-[220px] p-3 rounded-lg shadow-lg
                     chrome-surface-raised border border-[var(--reader-border)]"
          role="dialog"
          aria-label={t('reader.typography')}
        >
          <div className="flex items-center gap-1.5 text-xs font-medium mb-2.5 chrome-muted">
            <AlignLeft size={12} />
            {t('reader.typography')}
          </div>

          <label className="block text-[11px] chrome-muted mb-1">{t('reader.lineHeight')}</label>
          <select
            value={String(line)}
            onChange={(e) => setReadingLineHeight(Number(e.target.value))}
            className="w-full mb-2.5 text-xs bg-transparent border border-[var(--reader-border)]
                       rounded px-1.5 py-1 chrome-muted cursor-pointer"
          >
            {LINE_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v.toFixed(2)}
              </option>
            ))}
          </select>

          <label className="block text-[11px] chrome-muted mb-1">{t('reader.paragraphGap')}</label>
          <select
            value={String(para)}
            onChange={(e) => setReadingParagraphGap(Number(e.target.value))}
            className="w-full mb-2.5 text-xs bg-transparent border border-[var(--reader-border)]
                       rounded px-1.5 py-1 chrome-muted cursor-pointer"
          >
            {PARA_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v} rem
              </option>
            ))}
          </select>

          <label className="block text-[11px] chrome-muted mb-1">{t('reader.pageMargin')}</label>
          <select
            value={String(margin)}
            onChange={(e) => setReadingPageMargin(Number(e.target.value))}
            className="w-full text-xs bg-transparent border border-[var(--reader-border)]
                       rounded px-1.5 py-1 chrome-muted cursor-pointer"
          >
            {MARGIN_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v} rem
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
