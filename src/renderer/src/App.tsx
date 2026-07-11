import { useState, useEffect, useCallback } from 'react'
import AppShell from './components/layout/AppShell'
import LibraryView from './components/library/LibraryView'
import ReaderView from './components/reader/ReaderView'
import PdfReader from './components/reader/PdfReader'
import EpubReader from './components/reader/EpubReader'
import TxtReader from './components/reader/TxtReader'
import type { TocItem } from './components/reader/EpubReader'
import SettingsDialog from './components/layout/SettingsDialog'
import { useAppStore } from './stores/appStore'

export default function App() {
  const { currentView, currentBook, darkMode, setCurrentView, updateBookProgress } = useAppStore()
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    // Sync native window background for ClearType sub-pixel AA on Windows
    window.scrollAPI.setBackgroundColor(darkMode ? '#111827' : '#ffffff').catch(() => {})
  }, [darkMode])

  // Load library from storage on startup
  useEffect(() => {
    const loadLibrary = async () => {
      try {
        const saved = await window.scrollAPI.storage.get('books', [])
        if (Array.isArray(saved) && saved.length > 0) {
          useAppStore.getState().setBooks(saved)
        }
      } catch {
        // storage not available (first run)
      }
    }
    loadLibrary()
  }, [])

  // Save library whenever books change
  const { books } = useAppStore()
  useEffect(() => {
    if (books.length > 0) {
      window.scrollAPI.storage.set('books', books).catch(() => {})
    }
  }, [books])

  // Save AI config
  const { aiConfig } = useAppStore()
  useEffect(() => {
    if (aiConfig.apiKey) {
      window.scrollAPI.storage.set('aiConfig', aiConfig).catch(() => {})
    }
  }, [aiConfig])

  // Persist darkMode preference
  useEffect(() => {
    window.scrollAPI.storage.get('darkMode', true).then((saved) => {
      if (typeof saved === 'boolean') useAppStore.getState().setDarkMode(saved)
    }).catch(() => {})
  }, [])
  useEffect(() => {
    window.scrollAPI.storage.set('darkMode', darkMode).catch(() => {})
  }, [darkMode])

  // Load AI config on startup
  useEffect(() => {
    window.scrollAPI.storage.get('aiConfig', null).then((saved) => {
      if (saved) useAppStore.getState().setAiConfig(saved)
    }).catch(() => {})
  }, [])

  const handlePageChange = useCallback((page: number, total: number) => {
    if (currentBook) {
      const progress = Math.round((page / total) * 100)
      updateBookProgress(currentBook.id, progress, page)
      useAppStore.getState().setReadingPosition({ page, percent: progress })
    }
  }, [currentBook, updateBookProgress])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault()
        setShowSettings(true)
      }
      if (e.key === 'Escape' && currentView === 'reader') {
        setCurrentView('library')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentView])

  const renderReader = () => {
    if (!currentBook) return null
    // Set AI context when entering reader
    if (!useAppStore.getState().aiContext.bookTitle) {
      useAppStore.getState().setAiContext({ bookTitle: currentBook.title })
    }
    switch (currentBook.format.toUpperCase()) {
      case 'PDF':
        return (
          <PdfReader
            filePath={currentBook.path}
            onClose={() => setCurrentView('library')}
            onPageChange={handlePageChange}
            initialPage={currentBook.currentPage || undefined}
          />
        )
      case 'EPUB':
        return (
          <EpubReader
            filePath={currentBook.path}
            onClose={() => setCurrentView('library')}
            initialProgress={currentBook.progress || undefined}
            onProgress={(_chapter, progress) => {
              if (currentBook) {
                updateBookProgress(currentBook.id, progress, 0)
                useAppStore.getState().setReadingPosition({ percent: progress })
              }
            }}
            onTocReady={(toc: TocItem[]) => {
              useAppStore.getState().setToc(toc)
            }}
          />
        )
      case 'TXT':
      case 'MD':
      case 'MARKDOWN':
        return (
          <TxtReader
            filePath={currentBook.path}
            onClose={() => setCurrentView('library')}
            initialProgress={currentBook.progress || undefined}
            onProgress={(pct) => {
              if (currentBook) {
                updateBookProgress(currentBook.id, pct, 0)
                useAppStore.getState().setReadingPosition({ percent: pct })
              }
            }}
          />
        )
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
