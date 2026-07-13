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
  name: string
}

interface FontDef { css: string; name: string }

export const THEMES: Record<ThemeKey, ThemeDef> = {
  light: {
    bg: '#FFFFFF',
    text: '#333333',
    surface: '#F3F4F6',
    surfaceRaised: '#E8EAED',
    border: '#B8BFC9',
    muted: '#6B7280',
    name: '明亮'
  },
  paper: {
    bg: '#F5F0E8',
    text: '#4A3F35',
    surface: '#E8E0D4',
    surfaceRaised: '#DDD4C6',
    border: '#B8AA96',
    muted: '#7A6B5C',
    name: '纸张'
  },
  eyeCare: {
    bg: '#C7EDCC',
    text: '#2D4A32',
    surface: '#B5E0BB',
    surfaceRaised: '#A3D4AA',
    border: '#7FB889',
    muted: '#4A7352',
    name: '护眼'
  },
  dark: {
    bg: '#1A1A2E',
    text: '#C8C8D0',
    surface: '#24243A',
    surfaceRaised: '#2E2E48',
    border: '#454560',
    muted: '#9494A8',
    name: '暗色'
  },
  nature: {
    bg: '#F4ECD8',
    text: '#5D4E37',
    surface: '#E8DFC8',
    surfaceRaised: '#DDD2B8',
    border: '#B9A888',
    muted: '#8A7960',
    name: '自然'
  }
}

export const FONTS: Record<FontKey, FontDef> = {
  system: { css: '', name: '系统默认' },
  serif: { css: 'Georgia, "Noto Serif SC", "Source Han Serif SC", "STSong", serif', name: '宋体/衬线' },
  sans: {
    css: '"Inter", "Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
    name: '黑体/无衬线'
  }
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
