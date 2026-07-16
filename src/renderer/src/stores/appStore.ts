import { create } from 'zustand'
import {
  searchChapters as runChapterSearch,
  clearSearchHighlight,
  type SearchChapter,
  type SearchHit
} from '../lib/bookSearch'

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
  /** Absolute text offset in continuous readers — layout-stable vs percent alone */
  progressOffset?: number
  totalPages: number
  currentPage: number
}

export interface Bookmark {
  label: string
  href?: string
  page?: number
  percent?: number
  /** Same layout-stable anchor as Book.progressOffset */
  textOffset?: number
  time: number
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

  /** Line height multiplier for continuous readers (default 1.85) */
  readingLineHeight: number
  setReadingLineHeight: (v: number) => void
  /** Paragraph bottom margin in rem (default 1.25) */
  readingParagraphGap: number
  setReadingParagraphGap: (v: number) => void
  /** Horizontal page padding in rem (default 2) */
  readingPageMargin: number
  setReadingPageMargin: (v: number) => void
  /** Hide top bar / reader chrome for immersion */
  readerImmersive: boolean
  setReaderImmersive: (v: boolean) => void
  toggleReaderImmersive: () => void

  // Current book
  currentBook: Book | null
  openBook: (book: Book) => void

  // Library
  books: Book[]
  setBooks: (books: Book[]) => void
  addBook: (book: Book) => void
  removeBook: (id: string) => void
  updateBookProgress: (
    id: string,
    progress: number,
    currentPage: number,
    progressOffset?: number
  ) => void

  // AI config
  aiConfig: AiConfig
  setAiConfig: (config: Partial<AiConfig>) => void

  // Left sidebar (TOC + Bookmarks + Search)
  leftSidebarOpen: boolean
  leftSidebarTab: 'toc' | 'bookmarks' | 'search'
  toggleLeftSidebar: (tab: 'toc' | 'bookmarks' | 'search') => void
  setLeftSidebarTab: (tab: 'toc' | 'bookmarks' | 'search') => void
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

  // In-book search (EPUB / TXT / MOBI)
  searchChapters: SearchChapter[]
  setSearchChapters: (chapters: SearchChapter[]) => void
  searchQuery: string
  searchHits: SearchHit[]
  activeHitIndex: number
  /** Bumped to request SearchPanel input focus */
  searchFocusNonce: number
  setSearchQuery: (query: string) => void
  runSearch: (query?: string) => void
  setActiveHitIndex: (index: number) => void
  goToSearchHit: (index: number) => void
  clearSearch: () => void
  openSearchPanel: () => void
  /** Set when jumping to a hit — readers listen and clear */
  pendingSearchHit: SearchHit | null
  clearPendingSearchHit: () => void

  // Bookmarks (current book only; persisted in bookmarksByBook)
  bookmarks: Bookmark[]
  bookmarksByBook: Record<string, Bookmark[]>
  addBookmark: (bm: Bookmark) => void
  removeBookmark: (index: number) => void
  clearBookmarks: () => void
  setBookmarks: (bookmarks: Bookmark[]) => void
  setBookmarksByBook: (map: Record<string, Bookmark[]>) => void
  syncBookmarksForBook: (bookId: string) => void

  // Current reading position (for bookmark capture)
  readingPosition: { chapter?: string; page?: number; percent: number; textOffset?: number }
  setReadingPosition: (pos: {
    chapter?: string
    page?: number
    percent: number
    textOffset?: number
  }) => void

  // Navigate to a percentage position (for bookmark jump)
  navigateToPercent: number | null
  setNavigateToPercent: (pct: number | null) => void
  /** Prefer over percent when jumping in continuous HTML readers */
  navigateToTextOffset: number | null
  setNavigateToTextOffset: (offset: number | null) => void

  // Navigate to page (PDF / Comic)
  navigateToPage: number | null
  setNavigateToPage: (page: number | null) => void

  // AI context (current book + chapter content)
  aiContext: {
    bookTitle: string
    chapter?: string
    content?: string
    selection?: string
    page?: number
    pageTotal?: number
  }
  setAiContext: (ctx: Partial<AppState['aiContext']>) => void

  /** Prefill AI panel input (e.g. from text selection or annotation note) */
  aiDraft: string | null
  setAiDraft: (draft: string | null) => void
  requestAiPanel: boolean
  setRequestAiPanel: (open: boolean) => void
}

function sortBooksByRecent(books: Book[]): Book[] {
  return [...books].sort(
    (a, b) => (b.lastReadAt ?? b.addedAt ?? 0) - (a.lastReadAt ?? a.addedAt ?? 0)
  )
}

export const useAppStore = create<AppState>((set, get) => ({
  currentView: 'library',
  setCurrentView: (view) => set({ currentView: view }),

  darkMode: true,
  setDarkMode: (dark) =>
    set((s) => ({
      darkMode: dark,
      // 与阅读主题统一：暗色 ↔ dark；退出暗色时若当前是 dark 主题则回明亮
      readingTheme: dark ? 'dark' : s.readingTheme === 'dark' ? 'light' : s.readingTheme
    })),
  toggleDarkMode: () =>
    set((s) => {
      const dark = !s.darkMode
      return {
        darkMode: dark,
        readingTheme: dark ? 'dark' : s.readingTheme === 'dark' ? 'light' : s.readingTheme
      }
    }),

  readingTheme: 'light',
  setReadingTheme: (theme) => set({ readingTheme: theme, darkMode: theme === 'dark' }),

  readingFont: 'system',
  setReadingFont: (font) => set({ readingFont: font }),

  readerFontSize: 100,
  setReaderFontSize: (size) => set({ readerFontSize: Math.min(200, Math.max(60, Math.round(size))) }),

  readingLineHeight: 1.85,
  setReadingLineHeight: (v) =>
    set({ readingLineHeight: Math.min(2.6, Math.max(1.3, Math.round(v * 100) / 100)) }),

  readingParagraphGap: 1.25,
  setReadingParagraphGap: (v) =>
    set({ readingParagraphGap: Math.min(2.5, Math.max(0.5, Math.round(v * 100) / 100)) }),

  readingPageMargin: 2,
  setReadingPageMargin: (v) =>
    set({ readingPageMargin: Math.min(4, Math.max(0.75, Math.round(v * 100) / 100)) }),

  readerImmersive: false,
  setReaderImmersive: (v) => set({ readerImmersive: v }),
  toggleReaderImmersive: () => set((s) => ({ readerImmersive: !s.readerImmersive })),

  currentBook: null,
  openBook: (book) => {
    const s = get()
    let bookmarksByBook = s.bookmarksByBook
    if (s.currentBook) {
      bookmarksByBook = { ...bookmarksByBook, [s.currentBook.id]: s.bookmarks }
    }
    const now = Date.now()
    const opened = { ...book, lastReadAt: now }
    set({
      currentBook: opened,
      currentView: 'reader',
      books: sortBooksByRecent(
        s.books.map((b) => (b.id === book.id ? opened : b))
      ),
      bookmarks: bookmarksByBook[book.id] ?? [],
      bookmarksByBook,
      aiContext: { bookTitle: opened.title },
      aiDraft: null,
      searchChapters: [],
      searchQuery: '',
      searchHits: [],
      activeHitIndex: -1,
      pendingSearchHit: null
    })
  },

  books: [],
  setBooks: (books) => set({ books }),
  addBook: (book) =>
    set((s) => {
      if (s.books.find((b) => b.path === book.path)) return s
      return { books: sortBooksByRecent([book, ...s.books]) }
    }),
  removeBook: (id) => set((s) => ({ books: s.books.filter((b) => b.id !== id) })),
  updateBookProgress: (id, progress, currentPage, progressOffset) =>
    set((s) => {
      const cur = s.currentBook?.id === id ? s.currentBook : s.books.find((b) => b.id === id)
      if (!cur) return s
      const nextOffset =
        progressOffset != null && progressOffset >= 0 ? progressOffset : cur.progressOffset
      // Skip no-op updates (scroll fires often) — keeps React tree cool
      if (
        Math.abs(cur.progress - progress) < 0.35 &&
        cur.currentPage === currentPage &&
        (nextOffset == null || cur.progressOffset === nextOffset)
      ) {
        return s
      }
      const patch: Partial<Book> = {
        progress,
        currentPage,
        lastReadAt: Date.now()
      }
      if (progressOffset != null && progressOffset >= 0) {
        patch.progressOffset = progressOffset
      }
      // Do NOT re-sort on every scroll — sorting belongs to openBook / addBook
      return {
        books: s.books.map((b) => (b.id === id ? { ...b, ...patch } : b)),
        currentBook:
          s.currentBook?.id === id ? { ...s.currentBook, ...patch } : s.currentBook
      }
    }),

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

  searchChapters: [],
  setSearchChapters: (chapters) => set({ searchChapters: chapters }),
  searchQuery: '',
  searchHits: [],
  activeHitIndex: -1,
  searchFocusNonce: 0,
  setSearchQuery: (query) => set({ searchQuery: query }),
  runSearch: (query) => {
    const q = (query ?? get().searchQuery).trim()
    const hits = runChapterSearch(get().searchChapters, q)
    set({
      searchQuery: query !== undefined ? query : get().searchQuery,
      searchHits: hits,
      activeHitIndex: hits.length > 0 ? 0 : -1,
      pendingSearchHit: hits.length > 0 ? { ...hits[0] } : null
    })
    if (hits.length === 0) clearSearchHighlight()
  },
  setActiveHitIndex: (index) => set({ activeHitIndex: index }),
  goToSearchHit: (index) => {
    const hits = get().searchHits
    if (index < 0 || index >= hits.length) return
    set({ activeHitIndex: index, pendingSearchHit: { ...hits[index] } })
  },
  clearSearch: () => {
    clearSearchHighlight()
    set({
      searchQuery: '',
      searchHits: [],
      activeHitIndex: -1,
      pendingSearchHit: null
    })
  },
  openSearchPanel: () =>
    set((s) => ({
      leftSidebarOpen: true,
      leftSidebarTab: 'search',
      searchFocusNonce: s.searchFocusNonce + 1
    })),
  pendingSearchHit: null,
  clearPendingSearchHit: () => set({ pendingSearchHit: null }),

  bookmarks: [],
  bookmarksByBook: {},
  addBookmark: (bm) =>
    set((s) => {
      const next = [...s.bookmarks, bm]
      const bookId = s.currentBook?.id
      return {
        bookmarks: next,
        bookmarksByBook: bookId
          ? { ...s.bookmarksByBook, [bookId]: next }
          : s.bookmarksByBook
      }
    }),
  removeBookmark: (index) =>
    set((s) => {
      const next = s.bookmarks.filter((_, i) => i !== index)
      const bookId = s.currentBook?.id
      return {
        bookmarks: next,
        bookmarksByBook: bookId
          ? { ...s.bookmarksByBook, [bookId]: next }
          : s.bookmarksByBook
      }
    }),
  clearBookmarks: () =>
    set((s) => {
      const bookId = s.currentBook?.id
      return {
        bookmarks: [],
        bookmarksByBook: bookId
          ? { ...s.bookmarksByBook, [bookId]: [] }
          : s.bookmarksByBook
      }
    }),
  setBookmarks: (bookmarks) => set({ bookmarks }),
  setBookmarksByBook: (map) => set({ bookmarksByBook: map }),
  syncBookmarksForBook: (bookId) =>
    set((s) => ({ bookmarks: s.bookmarksByBook[bookId] ?? [] })),

  readingPosition: { percent: 0 },
  setReadingPosition: (pos) => set((s) => ({ readingPosition: { ...s.readingPosition, ...pos } })),

  navigateToTextOffset: null,
  setNavigateToTextOffset: (offset) => set({ navigateToTextOffset: offset }),

  navigateToPercent: null,
  setNavigateToPercent: (pct) => set({ navigateToPercent: pct }),

  navigateToPage: null,
  setNavigateToPage: (page) => set({ navigateToPage: page }),

  aiContext: { bookTitle: '' },
  setAiContext: (ctx) => set((s) => ({ aiContext: { ...s.aiContext, ...ctx } })),

  aiDraft: null,
  setAiDraft: (draft) => set({ aiDraft: draft }),
  requestAiPanel: false,
  setRequestAiPanel: (open) => set({ requestAiPanel: open })
}))
