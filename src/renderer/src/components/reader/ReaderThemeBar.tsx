import { useAppStore } from '../../stores/appStore'
import { THEMES, FONTS, type ThemeKey, type FontKey } from '../../lib/readingTheme'

export default function ReaderThemeBar() {
  const { readingTheme, setReadingTheme, readingFont, setReadingFont } = useAppStore()
  const themeKeys = Object.keys(THEMES) as ThemeKey[]
  const fontKeys = Object.keys(FONTS) as FontKey[]

  return (
    <div className="flex items-center gap-0.5">
      {/* Theme color dots */}
      {themeKeys.map((key) => {
        const t = THEMES[key]
        const active = readingTheme === key
        return (
          <button
            key={key}
            title={t.name}
            onClick={() => setReadingTheme(key)}
            className={`w-5 h-5 rounded-full border transition-colors
              ${active ? 'border-scroll-500 ring-1 ring-scroll-400' : 'border-[var(--reader-border)]'}
            `}
            style={{ backgroundColor: t.bg }}
          />
        )
      })}
      <span className="w-px h-5 bg-[var(--reader-border)] mx-1" />
      {/* Font selector */}
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
    </div>
  )
}
