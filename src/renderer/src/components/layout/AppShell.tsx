import { type ReactNode, lazy, Suspense, useEffect, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import TopBar from './TopBar'

const LeftSidebar = lazy(() => import('./LeftSidebar'))
const RightSidebar = lazy(() => import('./RightSidebar'))
const MusicPlayer = lazy(() => import('../music/MusicPlayer'))

interface Props {
  children: ReactNode
  onOpenSettings: () => void
}

export default function AppShell({ children, onOpenSettings }: Props) {
  const leftSidebarOpen = useAppStore((s) => s.leftSidebarOpen)
  const rightSidebarOpen = useAppStore((s) => s.rightSidebarOpen)
  const currentView = useAppStore((s) => s.currentView)
  const readerImmersive = useAppStore((s) => s.readerImmersive)
  const requestAiPanel = useAppStore((s) => s.requestAiPanel)
  const setRequestAiPanel = useAppStore((s) => s.setRequestAiPanel)
  const toggleRightSidebar = useAppStore((s) => s.toggleRightSidebar)
  const [musicReady, setMusicReady] = useState(false)

  useEffect(() => {
    if (requestAiPanel && currentView === 'reader') {
      if (!rightSidebarOpen) toggleRightSidebar()
      setRequestAiPanel(false)
    }
  }, [requestAiPanel, currentView, rightSidebarOpen, toggleRightSidebar, setRequestAiPanel])

  // Defer music player until after first paint / idle
  useEffect(() => {
    const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, opts?: { timeout: number }) => number)
    if (ric) {
      const id = ric(() => setMusicReady(true), { timeout: 1500 })
      return () => (window as any).cancelIdleCallback?.(id)
    }
    const t = window.setTimeout(() => setMusicReady(true), 400)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle(
      'reader-immersive',
      currentView === 'reader' && readerImmersive
    )
    return () => document.documentElement.classList.remove('reader-immersive')
  }, [currentView, readerImmersive])

  // Entering immersive: collapse sidebars for a clean frame
  useEffect(() => {
    if (currentView !== 'reader' || !readerImmersive) return
    const st = useAppStore.getState()
    if (st.leftSidebarOpen) st.toggleLeftSidebar(st.leftSidebarTab)
    if (st.rightSidebarOpen) st.toggleRightSidebar()
  }, [readerImmersive, currentView])

  const hideChrome = currentView === 'reader' && readerImmersive

  return (
    <div className={`h-screen flex flex-col transition-colors ${currentView === 'reader' ? 'reader-chrome' : 'bg-slate-50 dark:bg-gray-950'}`}>
      {!hideChrome && <TopBar onOpenSettings={onOpenSettings} />}

      <div className="flex-1 flex overflow-hidden">
        {currentView === 'reader' && leftSidebarOpen && (
          <Suspense fallback={null}><LeftSidebar /></Suspense>
        )}
        <main className="flex-1 overflow-hidden">{children}</main>
        {currentView === 'reader' && rightSidebarOpen && (
          <Suspense fallback={null}><RightSidebar /></Suspense>
        )}
      </div>

      {musicReady && (
        <Suspense fallback={null}>
          <MusicPlayer />
        </Suspense>
      )}
    </div>
  )
}
