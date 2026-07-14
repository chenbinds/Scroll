import { Pencil, Eraser, ChevronDown, Highlighter, Save } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { useAnnotationStore } from '../../../stores/annotationStore'
import BrushSettingsPanel from './BrushSettingsPanel'
import MarkSettingsPanel from './MarkSettingsPanel'
import { markToolSupported, type AnnotationTool } from '../../../lib/annotationTypes'

function ToolButton({
  tool,
  activeTool,
  label,
  icon: Icon,
  showChevron,
  onClick,
  onChevronClick,
  disabled,
  title
}: {
  tool: AnnotationTool
  activeTool: AnnotationTool
  label: string
  icon: typeof Pencil
  showChevron?: boolean
  onClick: () => void
  onChevronClick?: () => void
  disabled?: boolean
  title?: string
}) {
  const active = activeTool === tool
  return (
    <div className={`flex items-center ${disabled ? 'opacity-40' : ''}`} title={title}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`flex items-center gap-1 px-2 py-1 text-xs transition-colors
          ${active ? 'text-scroll-600 border-b-2 border-scroll-500' : 'chrome-muted hover:opacity-80'}
        `}
      >
        <Icon size={14} />
        <span>{label}</span>
      </button>
      {showChevron && !disabled && (
        <button
          type="button"
          onClick={onChevronClick}
          className={`p-0.5 -ml-0.5 transition-colors
            ${active ? 'text-scroll-600' : 'chrome-muted hover:opacity-80'}
          `}
          aria-label={`${label} menu`}
        >
          <ChevronDown size={12} />
        </button>
      )}
    </div>
  )
}

export default function AnnotationToolbar() {
  const { t } = useI18n()
  const activeTool = useAnnotationStore((s) => s.activeTool)
  const panelOpen = useAnnotationStore((s) => s.panelOpen)
  const dirty = useAnnotationStore((s) => s.dirty)
  const format = useAnnotationStore((s) => s.format)
  const setActiveTool = useAnnotationStore((s) => s.setActiveTool)
  const setPanelOpen = useAnnotationStore((s) => s.setPanelOpen)
  const saveNow = useAnnotationStore((s) => s.saveNow)
  const canMark = markToolSupported(format)

  return (
    <div className="relative flex items-center gap-0.5 mx-2 shrink-0">
      <div className="relative">
        <ToolButton
          tool="mark"
          activeTool={activeTool}
          label={t('annotation.mark')}
          icon={Highlighter}
          showChevron
          disabled={!canMark}
          onClick={() => setActiveTool('mark')}
          onChevronClick={() => {
            if (activeTool === 'mark') setPanelOpen(!panelOpen)
            else {
              setActiveTool('mark')
              setPanelOpen(true)
            }
          }}
        />
        {canMark && activeTool === 'mark' && panelOpen && (
          <MarkSettingsPanel onClose={() => setPanelOpen(false)} />
        )}
      </div>

      <div className="relative">
        <ToolButton
          tool="brush"
          activeTool={activeTool}
          label={t('annotation.brush')}
          icon={Pencil}
          showChevron
          onClick={() => setActiveTool('brush')}
          onChevronClick={() => {
            if (activeTool === 'brush') {
              setPanelOpen(!panelOpen)
            } else {
              setActiveTool('brush')
              setPanelOpen(true)
            }
          }}
        />
        {activeTool === 'brush' && panelOpen && (
          <BrushSettingsPanel onClose={() => setPanelOpen(false)} />
        )}
      </div>

      <ToolButton
        tool="eraser"
        activeTool={activeTool}
        label={t('annotation.eraser')}
        icon={Eraser}
        onClick={() => setActiveTool('eraser')}
      />

      <button
        type="button"
        disabled={!dirty}
        onClick={() => { void saveNow() }}
        className={`flex items-center gap-1 px-2 py-1 text-xs ml-1 rounded transition-colors
          ${dirty
            ? 'text-scroll-600 hover:bg-scroll-50 dark:hover:bg-scroll-900/30'
            : 'chrome-muted opacity-40 cursor-not-allowed'}
        `}
        title={t('annotation.save')}
      >
        <Save size={14} />
        <span>{t('annotation.save')}</span>
        {dirty && <span className="w-1.5 h-1.5 rounded-full bg-scroll-500" />}
      </button>
    </div>
  )
}
