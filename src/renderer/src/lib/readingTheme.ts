export type ThemeKey = 'light' | 'paper' | 'eyeCare' | 'dark' | 'nature'
export type FontKey = 'system' | 'serif' | 'sans'

interface ThemeDef { bg: string; text: string; name: string }
interface FontDef { css: string; name: string }

export const THEMES: Record<ThemeKey, ThemeDef> = {
  light:   { bg: '#FFFFFF', text: '#333333', name: '明亮' },
  paper:   { bg: '#F5F0E8', text: '#4A3F35', name: '纸张' },
  eyeCare: { bg: '#C7EDCC', text: '#333333', name: '护眼' },
  dark:    { bg: '#1A1A2E', text: '#C8C8D0', name: '暗色' },
  nature:  { bg: '#F4ECD8', text: '#5D4E37', name: '自然' },
}

export const FONTS: Record<FontKey, FontDef> = {
  system: { css: '', name: '系统默认' },
  serif:  { css: 'Georgia, "Noto Serif SC", "Source Han Serif SC", "STSong", serif', name: '宋体/衬线' },
  sans:   { css: '"Inter", "Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif', name: '黑体/无衬线' },
}

export function getThemeStyle(theme: ThemeKey, font: FontKey): React.CSSProperties {
  const t = THEMES[theme]
  const f = FONTS[font]
  return {
    backgroundColor: t.bg,
    color: t.text,
    fontFamily: f.css || undefined,
  }
}
