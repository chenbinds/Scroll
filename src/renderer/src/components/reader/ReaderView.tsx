import type { Book } from '../../stores/appStore'
import { useI18n } from '../../lib/i18n'

interface Props {
  book: Book
}

export default function ReaderView({ book }: Props) {
  const { t } = useI18n()

  const formatIcons: Record<string, string> = {
    PDF: '📄', EPUB: '📖', MOBI: '📘',
    TXT: '📝', MD: '📋', CBZ: '📚',
    DJVU: '📜', DJV: '📜'
  }

  return (
    <div className="h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-center max-w-md px-6">
        <div className="text-6xl mb-6">
          {formatIcons[book.format] || '📖'}
        </div>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {book.title}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
          {book.author} · {book.format}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-6 font-mono truncate max-w-full">
          {book.path}
        </p>

        <div className="bg-scroll-50 dark:bg-scroll-900/20 border border-scroll-200 dark:border-scroll-800
                        rounded-lg p-4 text-left">
          <h3 className="text-sm font-medium text-scroll-700 dark:text-scroll-300 mb-2">
            {t('reader.placeholder.title')}
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            {t('reader.placeholder.desc')}
          </p>
          <ul className="text-xs text-gray-500 dark:text-gray-500 mt-2 space-y-1 list-disc list-inside">
            <li>{t('reader.placeholder.pdf')}</li>
            <li>{t('reader.placeholder.epub')}</li>
            <li>{t('reader.placeholder.mobi')}</li>
            <li>{t('reader.placeholder.txt')}</li>
            <li>{t('reader.placeholder.cbz')}</li>
            <li>{t('reader.placeholder.djvu')}</li>
          </ul>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-600 mt-4">
          {t('reader.back')}
        </p>
      </div>
    </div>
  )
}
