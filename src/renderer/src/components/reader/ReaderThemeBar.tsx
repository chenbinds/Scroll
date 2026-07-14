import { useAppStore } from '../../stores/appStore'
import { FONTS, type FontKey } from '../../lib/readingTheme'
import ThemeSelect from './ThemeSelect'
import TypographyPanel from './TypographyPanel'

export default function ReaderThemeBar() {
  const { readingFont, setReadingFont } = useAppStore()
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
          <option key={key} value={key}>{FONTS[key].name}</option>
        ))}
      </select>
      <span className="chrome-divider" />
      <TypographyPanel />
    </div>
  )
}
