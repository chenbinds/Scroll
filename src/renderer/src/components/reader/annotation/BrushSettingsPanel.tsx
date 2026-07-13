import {
  Pencil,
  Minus,
  Waypoints,
  ArrowRight,
  Square,
  Circle,
  Star,
  Pentagon,
  X
} from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import {
  ANNOTATION_COLORS,
  BRUSH_SHAPES,
  type BrushShape
} from '../../../lib/annotationTypes'
import { useAnnotationStore } from '../../../stores/annotationStore'
import type { Translations } from '../../../lib/locales/zh'

const SHAPE_ICONS: Record<BrushShape, typeof Pencil> = {
  curve: Pencil,
  line: Minus,
  polyline: Waypoints,
  arrow: ArrowRight,
  rect: Square,
  circle: Circle,
  star: Star,
  polygon: Pentagon
}

interface Props {
  onClose: () => void
}

export default function BrushSettingsPanel({ onClose }: Props) {
  const { t } = useI18n()
  const brush = useAnnotationStore((s) => s.brush)
  const setBrush = useAnnotationStore((s) => s.setBrush)

  return (
    <div
      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[100] w-[300px]
                 chrome-surface-raised rounded-xl shadow-lg border border-[var(--reader-border)]
                 p-3 select-none"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium chrome-muted">{t('annotation.brushPanel')}</span>
        <button
          type="button"
          onClick={onClose}
          className="p-0.5 chrome-muted hover:opacity-80 transition-opacity"
          aria-label={t('annotation.close')}
        >
          <X size={14} />
        </button>
      </div>

      <p className="text-[11px] chrome-muted mb-1.5">{t('annotation.shapes')}</p>
      <div className="grid grid-cols-4 gap-1 mb-3">
        {BRUSH_SHAPES.map(({ shape, labelKey }) => {
          const Icon = SHAPE_ICONS[shape]
          const active = brush.shape === shape
          return (
            <button
              key={shape}
              type="button"
              title={t(labelKey as keyof Translations)}
              onClick={() => setBrush({ shape })}
              className={`flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg text-[10px] transition-colors cursor-pointer
                ${active ? 'bg-scroll-100 dark:bg-scroll-900/40 text-scroll-600' : 'chrome-muted hover:opacity-80'}
              `}
            >
              <Icon size={16} />
              <span className="leading-tight text-center">{t(labelKey as keyof Translations)}</span>
            </button>
          )
        })}
      </div>

      <p className="text-[11px] chrome-muted mb-1.5">{t('annotation.colors')}</p>
      <div className="grid grid-cols-6 gap-2 mb-3">
        {ANNOTATION_COLORS.map((color) => {
          const active = brush.color === color
          return (
            <button
              key={color}
              type="button"
              onClick={() => setBrush({ color })}
              className={`w-6 h-6 rounded-full transition-transform ring-offset-[var(--reader-surface-raised)]
                ${active ? 'ring-2 ring-offset-1 ring-scroll-500 scale-110' : 'hover:scale-105'}
              `}
              style={{
                backgroundColor: color,
                border: color === '#FFFFFF' ? '1px solid var(--reader-border)' : undefined
              }}
              aria-label={color}
            />
          )
        })}
      </div>

      <div className="space-y-2.5">
        <label className="flex items-center gap-2 text-[11px] chrome-muted">
          <span className="w-14 shrink-0">{t('annotation.opacity')}</span>
          <input
            type="range"
            min={10}
            max={100}
            value={brush.opacity}
            onChange={(e) => setBrush({ opacity: Number(e.target.value) })}
            className="flex-1 h-1 accent-scroll-500"
          />
          <span className="w-8 text-right tabular-nums">{brush.opacity}%</span>
        </label>
        <label className="flex items-center gap-2 text-[11px] chrome-muted">
          <span className="w-14 shrink-0">{t('annotation.lineWidth')}</span>
          <input
            type="range"
            min={1}
            max={12}
            value={brush.lineWidth}
            onChange={(e) => setBrush({ lineWidth: Number(e.target.value) })}
            className="flex-1 h-1 accent-scroll-500"
          />
          <span className="w-8 text-right tabular-nums">{brush.lineWidth}pt</span>
        </label>
      </div>
    </div>
  )
}
