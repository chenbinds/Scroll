import { ArrowLeft } from 'lucide-react'
import { useI18n } from '../../lib/i18n'

interface Props {
  onClick: () => void
}

/** Back-to-library control — matches reader chrome theme */
export default function BackToLibraryButton({ onClick }: Props) {
  const { t } = useI18n()
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-medium shrink-0
                 chrome-muted border border-[var(--reader-border)]
                 bg-[var(--reader-surface-raised)] hover:bg-[var(--reader-bg)]
                 hover:text-[var(--reader-text)] transition-colors"
    >
      <ArrowLeft size={15} strokeWidth={2} />
      <span>{t('app.backToLibrary')}</span>
    </button>
  )
}
