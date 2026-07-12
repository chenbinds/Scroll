import { useState, useEffect, useCallback } from 'react'
import AppShell from './components/layout/AppShell'
import LibraryView from './components/library/LibraryView'
import ReaderView from './components/reader/ReaderView'
import PdfReader from './components/reader/PdfReader'
import EpubReader from './components/reader/EpubReader'
import TxtReader from './components/reader/TxtReader'
import MobiReader from './components/reader/MobiReader'
import ComicReader from './components/reader/ComicReader'
import type { TocItem } from './components/reader/EpubReader'
import SettingsDialog from './components/layout/SettingsDialog'
import { useAppStore } from './stores/appStore'

const TOC_FORMATS = new Set(['EPUB', 'TXT', 'MD', 'MARKDOWN', 'MOBI', 'AZW', 'AZW3'])

export default function App() {
  const { currentView, currentBook, darkMode, setCurrentView, updateBookProgress } = useAppStore()
  const [showSettings, setShowSettings] = useState(false)
  const [convertedEpubPath, setConvertedEpubPath] = useState<string | null>(null)

  // Try Calibre conversion for MOBI/AZW3
  useEffect(() => {
    setConvertedEpubPath(null) // clear old book's epub immediately
    if (!currentBook) return
    const fmt = currentBook.format.toUpperCase()
    if (fmt === 'MOBI' || fmt === 'AZW' || fmt === 'AZW3') {
      window.scrollAPI.convertMobi(currentBook.path).then((epubPath: string | null) => {
        if (epubPath) setConvertedEpubPath(epubPath)
      }).catch(() => {})
    }
  }, [currentBook])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    window.scrollAPI.setBackgroundColor(darkMode ? '#111827' : '#ffffff').catch(() => {})
  }, [darkMode])

  // Load library from storage
  useEffect(() => {
    window.scrollAPI.storage.get('books', []).then((saved: unknown) => {
      if (Array.isArray(saved) && saved.length > 0) useAppStore.getState().setBooks(saved)
    }).catch(() => {})
  }, [])

  // Save library
  const { books } = useAppStore()
  useEffect(() => {
    if (books.length > 0) window.scrollAPI.storage.set('books', books).catch(() => {})
  }, [books])

  // Load bookmarks
  useEffect(() => {
    window.scrollAPI.storage.get('bookmarks', []).then((saved: unknown) => {
      if (Array.isArray(saved)) useAppStore.getState().setBookmarks(saved)
    }).catch(() => {})
  }, [])

  // Save bookmarks
  const { bookmarks } = useAppStore()
  useEffect(() => {
    window.scrollAPI.storage.set('bookmarks', bookmarks).catch(() => {})
  }, [bookmarks])

  // Save AI config
  const { aiConfig } = useAppStore()
  useEffect(() => {
    if (aiConfig.apiKey) window.scrollAPI.storage.set('aiConfig', aiConfig).catch(() => {})
  }, [aiConfig])

  // Persist darkMode
  useEffect(() => {
    window.scrollAPI.storage.get('darkMode', true).then((saved: unknown) => {
      if (typeof saved === 'boolean') useAppStore.getState().setDarkMode(saved)
    }).catch(() => {})
  }, [])
  useEffect(() => {
    window.scrollAPI.storage.set('darkMode', darkMode).catch(() => {})
  }, [darkMode])

  // Persist readingTheme
  useEffect(() => {
    window.scrollAPI.storage.get('readingTheme', 'light').then((saved: unknown) => {
      if (typeof saved === 'string') useAppStore.getState().setReadingTheme(saved as any)
    }).catch(() => {})
  }, [])
  const { readingTheme, readingFont } = useAppStore()
  useEffect(() => {
    window.scrollAPI.storage.set('readingTheme', readingTheme).catch(() => {})
  }, [readingTheme])
  useEffect(() => {
    window.scrollAPI.storage.set('readingFont', readingFont).catch(() => {})
  }, [readingFont])

  // Load AI config
  useEffect(() => {
    window.scrollAPI.storage.get('aiConfig', null).then((saved: unknown) => {
      if (saved) useAppStore.getState().setAiConfig(saved as Partial<import('./stores/appStore').AiConfig>)
    }).catch(() => {})
  }, [])

  // Auto-close left sidebar for formats without TOC
  useEffect(() => {
    if (!currentBook) return
    const format = currentBook.format.toUpperCase()
    if (!TOC_FORMATS.has(format)) {
      const st = useAppStore.getState()
      if (st.leftSidebarOpen) st.toggleLeftSidebar(st.leftSidebarTab)
    }
  }, [currentBook])

  // Back to library: clear TOC
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
          onTocReady={(toc: TocItem[]) => { useAppStore.getState().setToc(toc) }} />

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
        // Use Calibre-converted EPUB when available
        if (convertedEpubPath) {
          return <EpubReader filePath={convertedEpubPath} onClose={() => setCurrentView('library')}
            initialChapterIndex={currentBook.currentPage || 0}
            initialProgress={currentBook.progress || undefined}
            onProgress={(chapterIndex: number, _count: number, progress: number) => {
              updateBookProgress(currentBook.id, progress, chapterIndex)
              useAppStore.getState().setReadingPosition({ chapter: String(chapterIndex), page: chapterIndex, percent: progress })
            }}
            onTocReady={(toc: any) => { useAppStore.getState().setToc(toc) }} />
        }
        return <MobiReader filePath={currentBook.path} onClose={() => setCurrentView('library')}
          initialProgress={currentBook.progress || undefined}
          onProgress={(chapterIndex, _count, progress) => {
            updateBookProgress(currentBook.id, progress, chapterIndex)
            useAppStore.getState().setReadingPosition({ chapter: String(chapterIndex), page: chapterIndex, percent: progress })
          }}
          onTocReady={(toc: any) => { useAppStore.getState().setToc(toc) }}
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
      {currentView === 'library' && <LibraryView />}
      {currentView === 'reader' && renderReader()}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </AppShell>
  )
}
