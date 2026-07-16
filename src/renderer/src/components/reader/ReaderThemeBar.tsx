import { useAppStore } from '../../stores/appStore'
import { useI18n } from '../../lib/i18n'
import { FONTS, FONT_LABEL_KEY, type FontKey } from '../../lib/readingTheme'
import type { Translations } from '../../lib/locales/zh'
import ThemeSelect from './ThemeSelect'
import TypographyPanel from './TypographyPanel'

export default function ReaderThemeBar() {
  const { t } = useI18n()
  const readingFont = useAppStore((s) => s.readingFont)
  const setReadingFont = useAppStore((s) => s.setReadingFont)
  const fontKeys = Object.keys(FONTS) as FontKey[]

  return (
    <div className="flex items-center gap-0.5">
      <ThemeSelect variant="toolbar" />
      <span className="chrome-divider" />
      <select
        value={readingFont}
        onChange={(e) => setReadingFont(e.target.value as FontKey)}
        className="text-xs bg-transparent border border-[var(--reader-border)] rounded px-1 py-0.5
                   chrome-muted cursor-pointer"
      >
        {fontKeys.map((key) => (
          <option key={key} value={key}>
            {t(FONT_LABEL_KEY[key] as keyof Translations)}
          </option>
        ))}
      </select>
      <span className="chrome-divider" />
      <TypographyPanel />
    </div>
  )
}
