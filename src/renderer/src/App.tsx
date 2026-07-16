import { useState, useEffect, useCallback, lazy, Suspense, useMemo, startTransition } from 'react'
import AppShell from './components/layout/AppShell'
import { useAppStore, type Book } from './stores/appStore'
import { useAnnotationStore } from './stores/annotationStore'
import { getThemeCssVars } from './lib/readingTheme'
import { cleanBookTitle } from './lib/bookTitle'
import { isBootstrapHydrated } from './bootstrapHydrate'
import UnsavedAnnotationsDialog from './components/reader/annotation/UnsavedAnnotationsDialog'
import { useMusicStore } from './stores/musicStore'

const LibraryView = lazy(() => import('./components/library/LibraryView'))

const PdfReader = lazy(() => import('./components/reader/PdfReader'))
const EpubReader = lazy(() => import('./components/reader/EpubReader'))
const TxtReader = lazy(() => import('./components/reader/TxtReader'))
const MobiReader = lazy(() => import('./components/reader/MobiReader'))
const ComicReader = lazy(() => import('./components/reader/ComicReader'))
const ReaderView = lazy(() => import('./components/reader/ReaderView'))
const SettingsDialog = lazy(() => import('./components/layout/SettingsDialog'))

const TOC_FORMATS = new Set(['EPUB', 'TXT', 'MD', 'MARKDOWN', 'MOBI', 'AZW', 'AZW3'])

function ReaderFallback() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="flex gap-1.5">
        <span className="w-2.5 h-2.5 bg-scroll-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2.5 h-2.5 bg-scroll-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2.5 h-2.5 bg-scroll-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}

function LibraryFallback() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-600">
      <div className="flex gap-1.5 mb-4">
        <span className="w-2.5 h-2.5 bg-scroll-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2.5 h-2.5 bg-scroll-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2.5 h-2.5 bg-scroll-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}

/** Freeze open-book initials so scroll progress does not remount the reader. */
function ActiveReader({ book }: { book: Book }) {
  const setCurrentView = useAppStore((s) => s.setCurrentView)
  const initials = useMemo(
    () => ({
      chapter: book.currentPage || 0,
      progress: book.progress || undefined,
      textOffset: book.progressOffset
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only at open
    [book.id]
  )

  const onClose = useCallback(() => {
    setCurrentView('library')
  }, [setCurrentView])

  const onProgressContinuous = useCallback(
    (chapterIndex: number, _count: number, progress: number, textOffset?: number) => {
      const st = useAppStore.getState()
      st.updateBookProgress(book.id, progress, chapterIndex, textOffset)
      st.setReadingPosition({
        chapter: String(chapterIndex),
        page: chapterIndex,
        percent: Math.round(progress),
        textOffset
      })
    },
    [book.id]
  )

  const onProgressTxt = useCallback(
    (pct: number, textOffset?: number) => {
      const st = useAppStore.getState()
      st.updateBookProgress(book.id, pct, 0, textOffset)
      st.setReadingPosition({ percent: Math.round(pct), textOffset })
    },
    [book.id]
  )

  const onPageChange = useCallback(
    (page: number, total: number) => {
      const progress = Math.round((page / total) * 100)
      const st = useAppStore.getState()
      st.updateBookProgress(book.id, progress, page)
      st.setReadingPosition({ page, percent: progress })
    },
    [book.id]
  )

  const onTocReady = useCallback((toc: any[]) => {
    useAppStore.getState().setToc(toc)
  }, [])

  useEffect(() => {
    const st = useAppStore.getState()
    if (!st.aiContext.bookTitle) {
      st.setAiContext({ bookTitle: book.title })
    }
  }, [book.id, book.title])

  const format = book.format.toUpperCase()

  switch (format) {
    case 'PDF':
      return (
        <PdfReader
          filePath={book.path}
          onClose={onClose}
          onPageChange={onPageChange}
          initialPage={initials.chapter || undefined}
        />
      )
    case 'EPUB':
      return (
        <EpubReader
          filePath={book.path}
          onClose={onClose}
          initialChapterIndex={initials.chapter}
          initialProgress={initials.progress}
          initialTextOffset={initials.textOffset}
          onProgress={onProgressContinuous}
          onTocReady={onTocReady}
        />
      )
    case 'TXT':
    case 'MD':
    case 'MARKDOWN':
      return (
        <TxtReader
          filePath={book.path}
          onClose={onClose}
          initialProgress={initials.progress}
          initialTextOffset={initials.textOffset}
          onProgress={onProgressTxt}
        />
      )
    case 'MOBI':
    case 'AZW':
    case 'AZW3':
      return (
        <MobiReader
          filePath={book.path}
          onClose={onClose}
          initialProgress={initials.progress}
          initialTextOffset={initials.textOffset}
          onProgress={onProgressContinuous}
          onTocReady={onTocReady}
        />
      )
    case 'CBZ':
    case 'CBR':
      return (
        <ComicReader
          filePath={book.path}
          format={format as 'CBZ' | 'CBR'}
          onClose={onClose}
          onPageChange={onPageChange}
          initialPage={initials.chapter || undefined}
        />
      )
    default:
      return <ReaderView book={book} />
  }
}

export default function App() {
  const currentView = useAppStore((s) => s.currentView)
  const currentBookId = useAppStore((s) => s.currentBook?.id ?? null)
  const currentBookPath = useAppStore((s) => s.currentBook?.path)
  const currentBookFormat = useAppStore((s) => s.currentBook?.format)
  const currentBookTitle = useAppStore((s) => s.currentBook?.title)
  const darkMode = useAppStore((s) => s.darkMode)
  const setCurrentView = useAppStore((s) => s.setCurrentView)
  const [showSettings, setShowSettings] = useState(false)
  const [libraryReady, setLibraryReady] = useState(isBootstrapHydrated())

  // Stable book snapshot for reader mount (path/format/title); progress lives in store
  const readerBook = useMemo(() => {
    if (!currentBookId || !currentBookPath || !currentBookFormat) return null
    const live = useAppStore.getState().currentBook
    if (!live || live.id !== currentBookId) return null
    return live
  }, [currentBookId, currentBookPath, currentBookFormat, currentBookTitle])

  useEffect(() => {
    // Defer dark class — toggling it on a full EPUB DOM is expensive
    const id = requestAnimationFrame(() => {
      document.documentElement.classList.toggle('dark', darkMode)
      window.scrollAPI.setBackgroundColor(darkMode ? '#111827' : '#f8fafc').catch(() => {})
    })
    return () => cancelAnimationFrame(id)
  }, [darkMode])

  useEffect(() => {
    return window.scrollAPI.onCloseRequested(() => {
      const canLeave = useAnnotationStore.getState().requestLeave('quit')
      if (canLeave) {
        void window.scrollAPI.confirmClose()
      }
    })
  }, [])

  const pendingLeave = useAnnotationStore((s) => s.pendingLeave)

  const handleLeaveSave = useCallback(async () => {
    const target = await useAnnotationStore.getState().resolveLeave('save')
    if (!target) return
    if (target === 'quit') void window.scrollAPI.confirmClose()
    else setCurrentView('library')
  }, [setCurrentView])

  const handleLeaveDiscard = useCallback(async () => {
    const target = await useAnnotationStore.getState().resolveLeave('discard')
    if (!target) return
    if (target === 'quit') void window.scrollAPI.confirmClose()
    else setCurrentView('library')
  }, [setCurrentView])

  const handleLeaveCancel = useCallback(() => {
    useAnnotationStore.getState().cancelLeave()
    void window.scrollAPI.cancelClose()
  }, [])

  const readingTheme = useAppStore((s) => s.readingTheme)
  const readingFont = useAppStore((s) => s.readingFont)
  const readingLineHeight = useAppStore((s) => s.readingLineHeight)
  const readingParagraphGap = useAppStore((s) => s.readingParagraphGap)
  const readingPageMargin = useAppStore((s) => s.readingPageMargin)
  useEffect(() => {
    startTransition(() => {
      const vars = getThemeCssVars(readingTheme, readingFont)
      const root = document.documentElement
      for (const [key, value] of Object.entries(vars)) {
        root.style.setProperty(key, value)
      }
      root.style.setProperty('--reader-line-height', String(readingLineHeight))
      root.style.setProperty('--reader-paragraph-gap', `${readingParagraphGap}rem`)
      root.style.setProperty('--reader-page-margin', `${readingPageMargin}rem`)
    })
  }, [readingTheme, readingFont, readingLineHeight, readingParagraphGap, readingPageMargin])

  useEffect(() => {
    if (libraryReady) return
    const t0 = performance.now()
    let cancelled = false
    void window.scrollAPI.bootstrap().then((data) => {
      if (cancelled) return
      const st = useAppStore.getState()
      if (Array.isArray(data.books) && data.books.length > 0) {
        st.setBooks(
          data.books.map((b: any) => ({
            ...b,
            title: typeof b.title === 'string' ? cleanBookTitle(b.title) : b.title
          }))
        )
      }
      if (data.bookmarksByBook && typeof data.bookmarksByBook === 'object' && !Array.isArray(data.bookmarksByBook)) {
        st.setBookmarksByBook(data.bookmarksByBook as Record<string, Parameters<typeof st.setBookmarks>[0]>)
      }
      if (typeof data.readingTheme === 'string') st.setReadingTheme(data.readingTheme as any)
      else if (typeof data.darkMode === 'boolean') st.setDarkMode(data.darkMode)
      if (typeof data.readingFont === 'string') st.setReadingFont(data.readingFont as any)
      if (typeof data.readerFontSize === 'number') st.setReaderFontSize(data.readerFontSize)
      if (typeof data.readingLineHeight === 'number') st.setReadingLineHeight(data.readingLineHeight)
      if (typeof data.readingParagraphGap === 'number') st.setReadingParagraphGap(data.readingParagraphGap)
      if (typeof data.readingPageMargin === 'number') st.setReadingPageMargin(data.readingPageMargin)
      if (data.aiConfig) st.setAiConfig(data.aiConfig as any)
      setLibraryReady(true)
      console.log(`[scroll] renderer bootstrap done in ${(performance.now() - t0).toFixed(0)}ms`)
    }).catch((err) => {
      console.error('[scroll] bootstrap failed', err)
      setLibraryReady(true)
    })
    return () => { cancelled = true }
  }, [libraryReady])

  // Prefetch lazy chunks after first paint so first click is not a code-load stall
  useEffect(() => {
    if (!libraryReady) return
    const warm = () => {
      void import('./components/library/LibraryView')
      void import('./components/layout/LeftSidebar')
      void import('./components/layout/RightSidebar')
      void import('./components/reader/EpubReader')
      void import('./components/reader/MobiReader')
      void import('./components/reader/PdfReader')
      void import('./components/reader/TxtReader')
      void import('./components/layout/SettingsDialog')
      void import('./components/music/MusicPlayer')
    }
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(warm, { timeout: 1800 })
      return () => w.cancelIdleCallback?.(id)
    }
    const t = window.setTimeout(warm, 400)
    return () => clearTimeout(t)
  }, [libraryReady])

  // Persist settings without re-rendering App on every books[] tick
  const readerFontSize = useAppStore((s) => s.readerFontSize)
  useEffect(() => {
    if (!libraryReady) return
    window.scrollAPI.storage.set('readerFontSize', readerFontSize).catch(() => {})
  }, [readerFontSize, libraryReady])

  useEffect(() => {
    if (!libraryReady) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let prev = useAppStore.getState().books
    const unsub = useAppStore.subscribe((state) => {
      if (state.books === prev) return
      prev = state.books
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        const books = useAppStore.getState().books
        if (books.length === 0) return
        window.scrollAPI.storage.set('books', books).catch(() => {})
      }, 1200)
    })
    return () => {
      unsub()
      if (timer) clearTimeout(timer)
    }
  }, [libraryReady])

  const bookmarksByBook = useAppStore((s) => s.bookmarksByBook)
  useEffect(() => {
    if (!libraryReady) return
    const timer = setTimeout(() => {
      window.scrollAPI.storage.set('bookmarksByBook', bookmarksByBook).catch(() => {})
    }, 500)
    return () => clearTimeout(timer)
  }, [bookmarksByBook, libraryReady])

  const aiConfig = useAppStore((s) => s.aiConfig)
  useEffect(() => {
    if (!libraryReady) return
    if (aiConfig.apiKey) window.scrollAPI.storage.set('aiConfig', aiConfig).catch(() => {})
  }, [aiConfig, libraryReady])

  useEffect(() => {
    if (!libraryReady) return
    window.scrollAPI.storage.set('darkMode', darkMode).catch(() => {})
  }, [darkMode, libraryReady])

  useEffect(() => {
    if (!libraryReady) return
    window.scrollAPI.storage.set('readingTheme', readingTheme).catch(() => {})
  }, [readingTheme, libraryReady])

  useEffect(() => {
    if (!libraryReady) return
    window.scrollAPI.storage.set('readingFont', readingFont).catch(() => {})
  }, [readingFont, libraryReady])

  useEffect(() => {
    if (!libraryReady) return
    window.scrollAPI.storage.set('readingLineHeight', readingLineHeight).catch(() => {})
  }, [readingLineHeight, libraryReady])

  useEffect(() => {
    if (!libraryReady) return
    window.scrollAPI.storage.set('readingParagraphGap', readingParagraphGap).catch(() => {})
  }, [readingParagraphGap, libraryReady])

  useEffect(() => {
    if (!libraryReady) return
    window.scrollAPI.storage.set('readingPageMargin', readingPageMargin).catch(() => {})
  }, [readingPageMargin, libraryReady])

  useEffect(() => {
    if (!currentBookId) return
    const book = useAppStore.getState().currentBook
    if (!book) return
    const format = book.format.toUpperCase()
    if (!TOC_FORMATS.has(format)) {
      const st = useAppStore.getState()
      if (st.leftSidebarOpen) st.toggleLeftSidebar(st.leftSidebarTab)
    }
  }, [currentBookId])

  useEffect(() => {
    if (currentView !== 'reader') {
      useAppStore.getState().setReaderImmersive(false)
    }
  }, [currentView])

  useEffect(() => {
    if (currentView !== 'reader' || !currentBookId) return
    return () => {
      void window.scrollAPI.storage.set('books', useAppStore.getState().books)
    }
  }, [currentView, currentBookId])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'S') { e.preventDefault(); setShowSettings(true) }
      if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === 'f' || e.key === 'F') && currentView === 'reader') {
        e.preventDefault()
        useAppStore.getState().openSearchPanel()
        return
      }
      if (e.key === 'Escape' && currentView === 'reader') {
        e.preventDefault()
        const app = useAppStore.getState()
        if (app.readerImmersive) {
          app.setReaderImmersive(false)
          return
        }
        const store = useAnnotationStore.getState()
        if (store.pendingLeave) {
          store.cancelLeave()
          void window.scrollAPI.cancelClose()
          return
        }
        if (store.hasClickDraft) return
        const canLeave = store.requestLeave('library')
        if (canLeave) {
          useMusicStore.getState().pause()
          setCurrentView('library')
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentView, setCurrentView])

  return (
    <AppShell onOpenSettings={() => setShowSettings(true)}>
      {currentView === 'library' ? (
        <Suspense fallback={<LibraryFallback />}>
          <LibraryView libraryReady={libraryReady} />
        </Suspense>
      ) : (
        <Suspense fallback={<ReaderFallback />}>
          {readerBook ? <ActiveReader key={readerBook.id} book={readerBook} /> : null}
        </Suspense>
      )}
      {showSettings && (
        <Suspense fallback={null}>
          <SettingsDialog onClose={() => setShowSettings(false)} />
        </Suspense>
      )}
      <UnsavedAnnotationsDialog
        open={pendingLeave !== null}
        onSave={() => { void handleLeaveSave() }}
        onDiscard={() => { void handleLeaveDiscard() }}
        onCancel={handleLeaveCancel}
      />
    </AppShell>
  )
}
