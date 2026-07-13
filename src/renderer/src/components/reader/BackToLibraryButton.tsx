import { ArrowLeft } from 'lucide-react'
import { useI18n } from '../../lib/i18n'

interface Props {
  onClick: () => void
}

/** Prominent back-to-library control for reader toolbars / top bar */
export default function BackToLibraryButton({ onClick }: Props) {
  const { t } = useI18n()
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium
                 bg-scroll-500 text-white hover:bg-scroll-600 active:bg-scroll-700
                 transition-colors shrink-0 shadow-sm"
    >
      <ArrowLeft size={15} strokeWidth={2.5} />
      <span>{t('app.backToLibrary')}</span>
    </button>
  )
}
