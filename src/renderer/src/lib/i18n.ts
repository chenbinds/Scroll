import { create } from 'zustand'
import zh from './locales/zh'
import en from './locales/en'
import type { Translations } from './locales/zh'

export type Language = 'zh' | 'en'

const translations: Record<Language, Translations> = { zh, en }

interface I18nState {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: keyof Translations, params?: Record<string, string | number>) => string
}

export const useI18n = create<I18nState>((set, get) => ({
  language: 'zh',
  setLanguage: (lang) => set({ language: lang }),
  t: (key, params) => {
    const lang = get().language
    const dict = translations[lang]
    let text: string = (dict as Record<string, string>)[key] ?? (translations.zh as Record<string, string>)[key] ?? key

    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v))
      })
    }

    return text
  }
}))

// Convenience hook for components
export function t(key: keyof Translations, params?: Record<string, string | number>): string {
  return useI18n.getState().t(key, params)
}
