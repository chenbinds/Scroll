import { X } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { ANNOTATION_COLORS } from '../../../lib/annotationTypes'
import { useAnnotationStore } from '../../../stores/annotationStore'

interface Props {
  onClose: () => void
}

export default function MarkSettingsPanel({ onClose }: Props) {
  const { t } = useI18n()
  const markColor = useAnnotationStore((s) => s.markColor)
  const markOpacity = useAnnotationStore((s) => s.markOpacity)
  const setMarkStyle = useAnnotationStore((s) => s.setMarkStyle)

  return (
    <div
      className="absolute top-full left-0 mt-2 z-[100] w-[240px]
                 chrome-surface-raised rounded-xl shadow-lg border border-[var(--reader-border)]
                 p-3 select-none"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium chrome-muted">{t('annotation.markPanel')}</span>
        <button type="button" onClick={onClose} className="p-0.5 chrome-muted hover:opacity-80">
          <X size={14} />
        </button>
      </div>
      <p className="text-[11px] chrome-muted mb-1.5">{t('annotation.colors')}</p>
      <div className="grid grid-cols-6 gap-2 mb-3">
        {ANNOTATION_COLORS.map((color) => {
          const active = markColor === color
          return (
            <button
              key={color}
              type="button"
              onClick={() => setMarkStyle({ color })}
              className={`w-6 h-6 rounded-full transition-transform ring-offset-[var(--reader-surface-raised)]
                ${active ? 'ring-2 ring-offset-1 ring-scroll-500 scale-110' : 'hover:scale-105'}
              `}
              style={{
                backgroundColor: color,
                border: color === '#FFFFFF' ? '1px solid var(--reader-border)' : undefined
              }}
            />
          )
        })}
      </div>
      <label className="flex items-center gap-2 text-[11px] chrome-muted">
        <span className="w-14 shrink-0">{t('annotation.opacity')}</span>
        <input
          type="range"
          min={15}
          max={80}
          value={markOpacity}
          onChange={(e) => setMarkStyle({ opacity: Number(e.target.value) })}
          className="flex-1 h-1 accent-scroll-500"
        />
        <span className="w-8 text-right tabular-nums">{markOpacity}%</span>
      </label>
    </div>
  )
}
