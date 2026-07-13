import { create } from 'zustand'

export interface Book {
  id: string
  title: string
  author: string
  format: string
  path: string
  coverUrl?: string
  doubanRating?: number
  addedAt: number
  lastReadAt: number
  progress: number // 0-100
  totalPages: number
  currentPage: number
}

export interface AiConfig {
  name: string
  baseUrl: string
  apiKey: string
  model: string
  maxTokens: number
}

interface AppState {
  // View
  currentView: 'library' | 'reader'
  setCurrentView: (view: 'library' | 'reader') => void

  // Theme
  darkMode: boolean
  setDarkMode: (dark: boolean) => void
  toggleDarkMode: () => void

  // Reading theme (background + text color)
  readingTheme: 'light' | 'paper' | 'eyeCare' | 'dark' | 'nature'
  setReadingTheme: (theme: AppState['readingTheme']) => void

  // Reading font family
  readingFont: 'system' | 'serif' | 'sans'
  setReadingFont: (font: AppState['readingFont']) => void

  // Global reader font scale (EPUB/MOBI/TXT), persisted
  readerFontSize: number
  setReaderFontSize: (size: number) => void

  // Current book
  currentBook: Book | null
  openBook: (book: Book) => void

  // Library
  books: Book[]
  setBooks: (books: Book[]) => void
  addBook: (book: Book) => void
  removeBook: (id: string) => void
  updateBookProgress: (id: string, progress: number, currentPage: number) => void

  // AI config
  aiConfig: AiConfig
  setAiConfig: (config: Partial<AiConfig>) => void

  // Left sidebar (TOC + Bookmarks)
  leftSidebarOpen: boolean
  leftSidebarTab: 'toc' | 'bookmarks'
  toggleLeftSidebar: (tab: 'toc' | 'bookmarks') => void
  setLeftSidebarTab: (tab: 'toc' | 'bookmarks') => void
  // Right sidebar (AI)
  rightSidebarOpen: boolean
  toggleRightSidebar: () => void

  // TOC (for EPUB)
  toc: { label: string; href: string; spineIndex: number; subitems?: { label: string; href: string; spineIndex: number }[] }[]
  setToc: (toc: AppState['toc']) => void
  navigateToHref: string | null
  setNavigateToHref: (href: string | null) => void
  navigateToSpineIndex: number | null
  setNavigateToSpineIndex: (idx: number | null) => void
  // TOC nav refs are module-level exports from EpubReader/TxtReader
  // (useLayoutEffect sets them before paint — no timing hole)

  // Direct DOM reference to the reader scroll container — set via callback ref
  // TocPanel reads this to find and scroll to chapters
  _readerEl: HTMLElement | null
  _setReaderEl: (el: HTMLElement | null) => void

  // Bookmarks
  bookmarks: { label: string; href?: string; page?: number; percent?: number; time: number }[]
  addBookmark: (bm: AppState['bookmarks'][0]) => void
  removeBookmark: (index: number) => void
  clearBookmarks: () => void
  setBookmarks: (bookmarks: AppState['bookmarks']) => void

  // Current reading position (for bookmark capture)
  readingPosition: { chapter?: string; page?: number; percent: number }
  setReadingPosition: (pos: { chapter?: string; page?: number; percent: number }) => void

  // Navigate to a percentage position (for bookmark jump)
  navigateToPercent: number | null
  setNavigateToPercent: (pct: number | null) => void

  // AI context (current book + chapter content)
  aiContext: { bookTitle: string; chapter?: string; content?: string }
  setAiContext: (ctx: Partial<AppState['aiContext']>) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  currentView: 'library',
  setCurrentView: (view) => set({ currentView: view }),

  darkMode: true,
  setDarkMode: (dark) => set({ darkMode: dark }),
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),

  readingTheme: 'light',
  setReadingTheme: (theme) => set({ readingTheme: theme }),

  readingFont: 'system',
  setReadingFont: (font) => set({ readingFont: font }),

  readerFontSize: 100,
  setReaderFontSize: (size) => set({ readerFontSize: Math.min(200, Math.max(60, Math.round(size))) }),

  currentBook: null,
  openBook: (book) => set({ currentBook: book, currentView: 'reader' }),

  books: [],
  setBooks: (books) => set({ books }),
  addBook: (book) =>
    set((s) => {
      if (s.books.find((b) => b.path === book.path)) return s
      return { books: [book, ...s.books] }
    }),
  removeBook: (id) => set((s) => ({ books: s.books.filter((b) => b.id !== id) })),
  updateBookProgress: (id, progress, currentPage) =>
    set((s) => ({
      books: s.books.map((b) =>
        b.id === id ? { ...b, progress, currentPage, lastReadAt: Date.now() } : b
      )
    })),

  aiConfig: {
    name: 'Not configured',
    baseUrl: '',
    apiKey: '',
    model: '',
    maxTokens: 4096
  },
  setAiConfig: (config) => set((s) => ({ aiConfig: { ...s.aiConfig, ...config } })),

  leftSidebarOpen: false,
  leftSidebarTab: 'toc',
  toggleLeftSidebar: (tab) => set((s) => ({
    leftSidebarTab: tab,
    leftSidebarOpen: s.leftSidebarTab === tab ? !s.leftSidebarOpen : true
  })),
  setLeftSidebarTab: (tab) => set({ leftSidebarTab: tab }),
  rightSidebarOpen: false,
  toggleRightSidebar: () => set((s) => ({ rightSidebarOpen: !s.rightSidebarOpen })),

  toc: [],
  setToc: (toc) => set({ toc }),
  navigateToHref: null,
  setNavigateToHref: (href) => set({ navigateToHref: href }),
  navigateToSpineIndex: null,
  setNavigateToSpineIndex: (idx) => set({ navigateToSpineIndex: idx }),
  _readerEl: null,
  _setReaderEl: (el) => set({ _readerEl: el }),


  bookmarks: [],
  addBookmark: (bm) => set((s) => ({ bookmarks: [...s.bookmarks, bm] })),
  removeBookmark: (index) => set((s) => ({ bookmarks: s.bookmarks.filter((_, i) => i !== index) })),
  clearBookmarks: () => set({ bookmarks: [] }),
  setBookmarks: (bookmarks) => set({ bookmarks }),

  readingPosition: { percent: 0 },
  setReadingPosition: (pos) => set((s) => ({ readingPosition: { ...s.readingPosition, ...pos } })),

  navigateToPercent: null,
  setNavigateToPercent: (pct) => set({ navigateToPercent: pct }),

  aiContext: { bookTitle: '' },
  setAiContext: (ctx) => set((s) => ({ aiContext: { ...s.aiContext, ...ctx } }))
}))
