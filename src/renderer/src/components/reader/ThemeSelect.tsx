import { useEffect, useRef, useState, startTransition } from 'react'
import { ChevronDown } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useI18n } from '../../lib/i18n'
import { THEMES, THEME_LABEL_KEY, type ThemeKey } from '../../lib/readingTheme'
import type { Translations } from '../../lib/locales/zh'

interface Props {
  /** settings = wider panel style */
  variant?: 'toolbar' | 'settings'
}

export default function ThemeSelect({ variant = 'toolbar' }: Props) {
  const { t } = useI18n()
  const readingTheme = useAppStore((s) => s.readingTheme)
  const setReadingTheme = useAppStore((s) => s.setReadingTheme)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const themeKeys = Object.keys(THEMES) as ThemeKey[]
  const current = THEMES[readingTheme]

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const isSettings = variant === 'settings'
  const labelOf = (key: ThemeKey) => t(THEME_LABEL_KEY[key] as keyof Translations)

  return (
    <div ref={rootRef} className={`relative ${isSettings ? 'w-full' : ''}`}>
      <button
        type="button"
        title={t('theme.title')}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={
          isSettings
            ? `w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border
               border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900
               text-gray-700 dark:text-gray-300`
            : `flex items-center gap-1.5 text-xs bg-transparent border border-[var(--reader-border)]
               rounded px-1.5 py-0.5 chrome-muted cursor-pointer hover:opacity-90`
        }
      >
        <span
          className="w-3.5 h-3.5 rounded-full border border-black/20 dark:border-white/25 flex-shrink-0"
          style={{ backgroundColor: current.bg }}
        />
        <span className="flex-1 text-left">{labelOf(readingTheme)}</span>
        <ChevronDown size={12} className={`opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className={
            isSettings
              ? `absolute z-50 left-0 right-0 mt-1 py-1 rounded-lg border shadow-lg
                 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900`
              : `absolute z-50 left-0 mt-1 min-w-[8.5rem] py-1 rounded-md border shadow-lg
                 border-[var(--reader-border)] chrome-surface-raised`
          }
        >
          {themeKeys.map((key) => {
            const theme = THEMES[key]
            const active = readingTheme === key
            return (
              <button
                key={key}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setOpen(false)
                  // Apply theme after dropdown closes so click feels instant
                  startTransition(() => setReadingTheme(key))
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors
                  ${active
                    ? isSettings
                      ? 'bg-scroll-50 dark:bg-scroll-900/40 text-scroll-700 dark:text-scroll-300'
                      : 'bg-[var(--reader-surface)] text-[var(--reader-text)]'
                    : isSettings
                      ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      : 'chrome-muted hover:bg-[var(--reader-surface)]'
                  }`}
              >
                <span
                  className={`w-4 h-4 rounded-full flex-shrink-0 border
                    ${active ? 'border-scroll-500 ring-1 ring-scroll-400' : 'border-black/20 dark:border-white/25'}`}
                  style={{ backgroundColor: theme.bg }}
                />
                <span>{labelOf(key)}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
