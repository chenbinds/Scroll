import { useAppStore } from './stores/appStore'
import { cleanBookTitle } from './lib/bookTitle'

let hydrated = false

export function isBootstrapHydrated(): boolean {
  return hydrated
}

/** Hydrate Zustand from preload bootstrap before first React paint. */
export async function hydrateFromBootstrap(): Promise<void> {
  if (hydrated || !window.scrollAPI) return
  try {
    const data = await window.scrollAPI.bootstrap()
    const st = useAppStore.getState()
    if (Array.isArray(data.books) && data.books.length > 0) {
      st.setBooks(
        data.books.map((b: Record<string, unknown>) => ({
          ...b,
          title: typeof b.title === 'string' ? cleanBookTitle(b.title) : b.title
        })) as Parameters<typeof st.setBooks>[0]
      )
    }
    if (Array.isArray(data.bookmarks)) st.setBookmarks(data.bookmarks as Parameters<typeof st.setBookmarks>[0])
    if (typeof data.darkMode === 'boolean') {
      st.setDarkMode(data.darkMode)
      document.documentElement.classList.toggle('dark', data.darkMode)
    }
    if (typeof data.readingTheme === 'string') st.setReadingTheme(data.readingTheme as Parameters<typeof st.setReadingTheme>[0])
    if (typeof data.readingFont === 'string') st.setReadingFont(data.readingFont as Parameters<typeof st.setReadingFont>[0])
    if (typeof data.readerFontSize === 'number') st.setReaderFontSize(data.readerFontSize)
    if (data.aiConfig) st.setAiConfig(data.aiConfig as Parameters<typeof st.setAiConfig>[0])
    hydrated = true
  } catch (err) {
    console.error('[scroll] bootstrap hydrate failed', err)
  }
}
