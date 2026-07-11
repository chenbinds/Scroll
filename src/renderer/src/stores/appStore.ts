import { create } from 'zustand'

export interface Book {
  id: string
  title: string
  author: string
  format: string
  path: string
  coverUrl?: string
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
  // 视图
  currentView: 'library' | 'reader'
  setCurrentView: (view: 'library' | 'reader') => void

  // 主题
  darkMode: boolean
  setDarkMode: (dark: boolean) => void
  toggleDarkMode: () => void

  // 当前阅读的书籍
  currentBook: Book | null
  openBook: (book: Book) => void

  // 书架
  books: Book[]
  setBooks: (books: Book[]) => void
  addBook: (book: Book) => void
  removeBook: (id: string) => void
  updateBookProgress: (id: string, progress: number, currentPage: number) => void

  // AI 配置
  aiConfig: AiConfig
  setAiConfig: (config: Partial<AiConfig>) => void

  // 左侧栏（目录 + 书签）
  leftSidebarOpen: boolean
  leftSidebarTab: 'toc' | 'bookmarks'
  toggleLeftSidebar: (tab: 'toc' | 'bookmarks') => void
  // 右侧栏（AI 助手）
  rightSidebarOpen: boolean
  toggleRightSidebar: () => void

  // TOC (for EPUB)
  toc: { label: string; href: string; subitems?: { label: string; href: string }[] }[]
  setToc: (toc: AppState['toc']) => void
  navigateToHref: string | null
  setNavigateToHref: (href: string | null) => void

  // Bookmarks
  bookmarks: { label: string; href: string; page?: number; percent?: number; time: number }[]
  addBookmark: (bm: AppState['bookmarks'][0]) => void
  removeBookmark: (index: number) => void
  clearBookmarks: () => void

  // Current reading position (for bookmark capture)
  readingPosition: { chapter?: string; page?: number; percent: number }
  setReadingPosition: (pos: { chapter?: string; page?: number; percent: number }) => void

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

  currentBook: null,
  openBook: (book) => set({ currentBook: book, currentView: 'reader' }),

  books: [],
  setBooks: (books) => set({ books }),
  addBook: (book) =>
    set((s) => {
      // 避免重复添加
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
    name: '未配置',
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
  rightSidebarOpen: false,
  toggleRightSidebar: () => set((s) => ({ rightSidebarOpen: !s.rightSidebarOpen })),

  toc: [],
  setToc: (toc) => set({ toc }),
  navigateToHref: null,
  setNavigateToHref: (href) => set({ navigateToHref: href }),

  bookmarks: [],
  addBookmark: (bm) => set((s) => ({ bookmarks: [...s.bookmarks, bm] })),
  removeBookmark: (index) => set((s) => ({ bookmarks: s.bookmarks.filter((_, i) => i !== index) })),
  clearBookmarks: () => set({ bookmarks: [] }),

  readingPosition: { percent: 0 },
  setReadingPosition: (pos) => set((s) => ({ readingPosition: { ...s.readingPosition, ...pos } })),

  aiContext: { bookTitle: '' },
  setAiContext: (ctx) => set((s) => ({ aiContext: { ...s.aiContext, ...ctx } }))
}))
