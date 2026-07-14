import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import AppShell from './components/layout/AppShell'
import { useAppStore } from './stores/appStore'
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

export default function App() {
  const { currentView, currentBook, darkMode, setCurrentView, updateBookProgress } = useAppStore()
  const [showSettings, setShowSettings] = useState(false)
  const [libraryReady, setLibraryReady] = useState(isBootstrapHydrated())

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    window.scrollAPI.setBackgroundColor(darkMode ? '#111827' : '#f8fafc').catch(() => {})
  }, [darkMode])

  // Unified leave: window X → same React dialog as 返回书架
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
    const vars = getThemeCssVars(readingTheme, readingFont)
    const root = document.documentElement
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value)
    }
    root.style.setProperty('--reader-line-height', String(readingLineHeight))
    root.style.setProperty('--reader-paragraph-gap', `${readingParagraphGap}rem`)
    root.style.setProperty('--reader-page-margin', `${readingPageMargin}rem`)
  }, [readingTheme, readingFont, readingLineHeight, readingParagraphGap, readingPageMargin])

  // Fallback bootstrap if hydrate ran before scrollAPI (HMR / edge cases)
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

  const readerFontSize = useAppStore((s) => s.readerFontSize)
  useEffect(() => {
    if (!libraryReady) return
    window.scrollAPI.storage.set('readerFontSize', readerFontSize).catch(() => {})
  }, [readerFontSize, libraryReady])

  const { books } = useAppStore()
  useEffect(() => {
    if (!libraryReady || books.length === 0) return
    const timer = setTimeout(() => {
      window.scrollAPI.storage.set('books', books).catch(() => {})
    }, 800)
    return () => clearTimeout(timer)
  }, [books, libraryReady])

  const bookmarksByBook = useAppStore((s) => s.bookmarksByBook)
  useEffect(() => {
    if (!libraryReady) return
    const timer = setTimeout(() => {
      window.scrollAPI.storage.set('bookmarksByBook', bookmarksByBook).catch(() => {})
    }, 500)
    return () => clearTimeout(timer)
  }, [bookmarksByBook, libraryReady])

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
    if (!currentBook) return
    const format = currentBook.format.toUpperCase()
    if (!TOC_FORMATS.has(format)) {
      const st = useAppStore.getState()
      if (st.leftSidebarOpen) st.toggleLeftSidebar(st.leftSidebarTab)
    }
  }, [currentBook])

  // Leave immersive when leaving reader
  useEffect(() => {
    if (currentView !== 'reader') {
      useAppStore.getState().setReaderImmersive(false)
    }
  }, [currentView])

  useEffect(() => {
    if (currentView !== 'reader' || !currentBook) return
    return () => {
      // Esc / 窗口切换离开时同步落盘（按钮离开也会再 flush 一次，无害）
      void window.scrollAPI.storage.set('books', useAppStore.getState().books)
    }
  }, [currentView, currentBook?.id])

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
        // Leave dialog open → Esc cancels (same as 取消)
        if (store.pendingLeave) {
          store.cancelLeave()
          void window.scrollAPI.cancelClose()
          return
        }
        // Polyline/polygon draft → Esc cancels draft only (Phase S leave still via 返回/X)
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
          initialTextOffset={currentBook.progressOffset}
          onProgress={(chapterIndex, _count, progress, textOffset) => {
            updateBookProgress(currentBook.id, progress, chapterIndex, textOffset)
            useAppStore.getState().setReadingPosition({
              chapter: String(chapterIndex),
              page: chapterIndex,
              percent: Math.round(progress),
              textOffset
            })
          }}
          onTocReady={(toc) => { useAppStore.getState().setToc(toc) }} />

      case 'TXT':
      case 'MD':
      case 'MARKDOWN':
        return <TxtReader filePath={currentBook.path} onClose={() => setCurrentView('library')}
          initialProgress={currentBook.progress || undefined}
          initialTextOffset={currentBook.progressOffset}
          onProgress={(pct, textOffset) => {
            updateBookProgress(currentBook.id, pct, 0, textOffset)
            useAppStore.getState().setReadingPosition({ percent: Math.round(pct), textOffset })
          }} />

      case 'MOBI':
      case 'AZW':
      case 'AZW3':
        return <MobiReader filePath={currentBook.path} onClose={() => setCurrentView('library')}
          initialProgress={currentBook.progress || undefined}
          initialTextOffset={currentBook.progressOffset}
          onProgress={(chapterIndex, _count, progress, textOffset) => {
            updateBookProgress(currentBook.id, progress, chapterIndex, textOffset)
            useAppStore.getState().setReadingPosition({
              chapter: String(chapterIndex),
              page: chapterIndex,
              percent: Math.round(progress),
              textOffset
            })
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
      {currentView === 'library' ? (
        <Suspense fallback={<LibraryFallback />}>
          <LibraryView libraryReady={libraryReady} />
        </Suspense>
      ) : (
        <Suspense fallback={<ReaderFallback />}>{renderReader()}</Suspense>
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
