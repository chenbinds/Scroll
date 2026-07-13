import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import AppShell from './components/layout/AppShell'
import LibraryView from './components/library/LibraryView'
import { useAppStore } from './stores/appStore'
import { getThemeStyle } from './lib/readingTheme'
import { cleanBookTitle } from './lib/bookTitle'

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

export default function App() {
  const { currentView, currentBook, darkMode, setCurrentView, updateBookProgress } = useAppStore()
  const [showSettings, setShowSettings] = useState(false)
  const [libraryReady, setLibraryReady] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    window.scrollAPI.setBackgroundColor(darkMode ? '#111827' : '#f8fafc').catch(() => {})
  }, [darkMode])

  const readingTheme = useAppStore((s) => s.readingTheme)
  const readingFont = useAppStore((s) => s.readingFont)
  useEffect(() => {
    const style = getThemeStyle(readingTheme, readingFont)
    const root = document.documentElement
    root.style.setProperty('--reader-bg', style.backgroundColor)
    root.style.setProperty('--reader-text', style.color)
    if (style.fontFamily) root.style.setProperty('--reader-font', style.fontFamily)
    else root.style.removeProperty('--reader-font')
  }, [readingTheme, readingFont])

  // Single bootstrap IPC — all startup state at once
  useEffect(() => {
    const t0 = performance.now()
    let cancelled = false
    window.scrollAPI.bootstrap().then((data) => {
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
      if (Array.isArray(data.bookmarks)) st.setBookmarks(data.bookmarks as any)
      if (typeof data.darkMode === 'boolean') st.setDarkMode(data.darkMode)
      if (typeof data.readingTheme === 'string') st.setReadingTheme(data.readingTheme as any)
      if (typeof data.readingFont === 'string') st.setReadingFont(data.readingFont as any)
      if (data.aiConfig) st.setAiConfig(data.aiConfig as any)
      setLibraryReady(true)
      console.log(`[scroll] renderer bootstrap done in ${(performance.now() - t0).toFixed(0)}ms`)
    }).catch((err) => {
      console.error('[scroll] bootstrap failed', err)
      setLibraryReady(true)
    })
    return () => { cancelled = true }
  }, [])

  const { books } = useAppStore()
  useEffect(() => {
    if (!libraryReady || books.length === 0) return
    const timer = setTimeout(() => {
      window.scrollAPI.storage.set('books', books).catch(() => {})
    }, 800)
    return () => clearTimeout(timer)
  }, [books, libraryReady])

  const { bookmarks } = useAppStore()
  useEffect(() => {
    if (!libraryReady) return
    const timer = setTimeout(() => {
      window.scrollAPI.storage.set('bookmarks', bookmarks).catch(() => {})
    }, 500)
    return () => clearTimeout(timer)
  }, [bookmarks, libraryReady])

  const { aiConfig } = useAppStore()
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
    if (!currentBook) return
    const format = currentBook.format.toUpperCase()
    if (!TOC_FORMATS.has(format)) {
      const st = useAppStore.getState()
      if (st.leftSidebarOpen) st.toggleLeftSidebar(st.leftSidebarTab)
    }
  }, [currentBook])

  useEffect(() => {
    if (currentView === 'library') {
      useAppStore.getState().setToc([])
    }
  }, [currentView])

  const handlePageChange = useCallback((page: number, total: number) => {
    if (currentBook) {
      const progress = Math.round((page / total) * 100)
      updateBookProgress(currentBook.id, progress, page)
      useAppStore.getState().setReadingPosition({ page, percent: progress })
    }
  }, [currentBook, updateBookProgress])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'S') { e.preventDefault(); setShowSettings(true) }
      if (e.key === 'Escape' && currentView === 'reader') setCurrentView('library')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentView, setCurrentView])

  const renderReader = () => {
    if (!currentBook) return null

    if (!useAppStore.getState().aiContext.bookTitle) {
      useAppStore.getState().setAiContext({ bookTitle: currentBook.title })
    }

    switch (currentBook.format.toUpperCase()) {
      case 'PDF':
        return <PdfReader filePath={currentBook.path} onClose={() => setCurrentView('library')}
          onPageChange={handlePageChange}
          initialPage={currentBook.currentPage || undefined} />

      case 'EPUB':
        return <EpubReader filePath={currentBook.path} onClose={() => setCurrentView('library')}
          initialChapterIndex={currentBook.currentPage || 0}
          initialProgress={currentBook.progress || undefined}
          onProgress={(chapterIndex, _count, progress) => {
            updateBookProgress(currentBook.id, progress, chapterIndex)
            useAppStore.getState().setReadingPosition({ chapter: String(chapterIndex), page: chapterIndex, percent: progress })
          }}
          onTocReady={(toc) => { useAppStore.getState().setToc(toc) }} />

      case 'TXT':
      case 'MD':
      case 'MARKDOWN':
        return <TxtReader filePath={currentBook.path} onClose={() => setCurrentView('library')}
          initialProgress={currentBook.progress || undefined}
          onProgress={(pct) => {
            updateBookProgress(currentBook.id, pct, 0)
            useAppStore.getState().setReadingPosition({ percent: pct })
          }} />

      case 'MOBI':
      case 'AZW':
      case 'AZW3':
        return <MobiReader filePath={currentBook.path} onClose={() => setCurrentView('library')}
          initialProgress={currentBook.progress || undefined}
          onProgress={(chapterIndex, _count, progress) => {
            updateBookProgress(currentBook.id, progress, chapterIndex)
            useAppStore.getState().setReadingPosition({ chapter: String(chapterIndex), page: chapterIndex, percent: progress })
          }}
          onTocReady={(toc) => { useAppStore.getState().setToc(toc) }}
          />

      case 'CBZ':
      case 'CBR':
        return <ComicReader filePath={currentBook.path} format={currentBook.format.toUpperCase() as 'CBZ' | 'CBR'}
          onClose={() => setCurrentView('library')}
          onPageChange={(page, total) => {
            const progress = Math.round((page / total) * 100)
            updateBookProgress(currentBook.id, progress, page)
            useAppStore.getState().setReadingPosition({ page, percent: progress })
          }}
          initialPage={currentBook.currentPage || undefined} />

      default:
        return <ReaderView book={currentBook} />
    }
  }

  return (
    <AppShell onOpenSettings={() => setShowSettings(true)}>
      {currentView === 'library' ? <LibraryView /> : (
        <Suspense fallback={<ReaderFallback />}>{renderReader()}</Suspense>
      )}
      {showSettings && (
        <Suspense fallback={null}>
          <SettingsDialog onClose={() => setShowSettings(false)} />
        </Suspense>
      )}
    </AppShell>
  )
}
