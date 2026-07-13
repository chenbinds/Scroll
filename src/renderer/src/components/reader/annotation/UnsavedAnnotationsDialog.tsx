import { useI18n } from '../../../lib/i18n'

interface Props {
  open: boolean
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

export default function UnsavedAnnotationsDialog({ open, onSave, onDiscard, onCancel }: Props) {
  const { t } = useI18n()
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="chrome-surface-raised rounded-xl shadow-xl border border-[var(--reader-border)]
                   w-[360px] max-w-[90vw] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-medium mb-1">{t('annotation.unsavedTitle')}</h3>
        <p className="text-xs chrome-muted mb-4 leading-relaxed">{t('annotation.unsavedDesc')}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded-lg chrome-muted hover:opacity-80 transition-opacity"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="px-3 py-1.5 text-xs rounded-lg border border-[var(--reader-border)] chrome-muted hover:opacity-80 transition-opacity"
          >
            {t('annotation.discard')}
          </button>
          <button
            type="button"
            onClick={onSave}
            className="px-3 py-1.5 text-xs rounded-lg bg-scroll-500 text-white hover:bg-scroll-600 transition-colors"
          >
            {t('annotation.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
