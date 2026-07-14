export type ThemeKey = 'light' | 'paper' | 'eyeCare' | 'dark' | 'nature'
export type FontKey = 'system' | 'serif' | 'sans'

interface ThemeDef {
  bg: string
  text: string
  /** Toolbar / sidebar panel */
  surface: string
  /** Raised tab / active panel */
  surfaceRaised: string
  border: string
  muted: string
}

interface FontDef { css: string }

export const THEMES: Record<ThemeKey, ThemeDef> = {
  light: {
    bg: '#FFFFFF',
    text: '#333333',
    surface: '#F3F4F6',
    surfaceRaised: '#E8EAED',
    border: '#B8BFC9',
    muted: '#6B7280'
  },
  paper: {
    bg: '#F5F0E8',
    text: '#4A3F35',
    surface: '#E8E0D4',
    surfaceRaised: '#DDD4C6',
    border: '#B8AA96',
    muted: '#7A6B5C'
  },
  eyeCare: {
    bg: '#C7EDCC',
    text: '#2D4A32',
    surface: '#B5E0BB',
    surfaceRaised: '#A3D4AA',
    border: '#7FB889',
    muted: '#4A7352'
  },
  dark: {
    bg: '#1A1A2E',
    text: '#C8C8D0',
    surface: '#24243A',
    surfaceRaised: '#2E2E48',
    border: '#454560',
    muted: '#9494A8'
  },
  nature: {
    bg: '#F4ECD8',
    text: '#5D4E37',
    surface: '#E8DFC8',
    surfaceRaised: '#DDD2B8',
    border: '#B9A888',
    muted: '#8A7960'
  }
}

export const FONTS: Record<FontKey, FontDef> = {
  system: { css: '' },
  serif: { css: 'Georgia, "Noto Serif SC", "Source Han Serif SC", "STSong", serif' },
  sans: {
    css: '"Inter", "Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif'
  }
}

export const THEME_LABEL_KEY: Record<ThemeKey, string> = {
  light: 'theme.light',
  paper: 'theme.paper',
  eyeCare: 'theme.eyeCare',
  dark: 'theme.dark',
  nature: 'theme.nature'
}

export const FONT_LABEL_KEY: Record<FontKey, string> = {
  system: 'font.system',
  serif: 'font.serif',
  sans: 'font.sans'
}

export function getThemeStyle(theme: ThemeKey, font: FontKey): React.CSSProperties {
  const t = THEMES[theme]
  const f = FONTS[font]
  return {
    backgroundColor: t.bg,
    color: t.text,
    fontFamily: f.css || undefined
  }
}

/** CSS variables for full-window reader chrome */
export function getThemeCssVars(theme: ThemeKey, font: FontKey): Record<string, string> {
  const t = THEMES[theme]
  const f = FONTS[font]
  return {
    '--reader-bg': t.bg,
    '--reader-text': t.text,
    '--reader-surface': t.surface,
    '--reader-surface-raised': t.surfaceRaised,
    '--reader-border': t.border,
    '--reader-muted': t.muted,
    '--reader-font': f.css || 'inherit'
  }
}
