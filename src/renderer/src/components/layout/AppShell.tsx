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
  const { leftSidebarOpen, rightSidebarOpen, currentView } = useAppStore()
  const [musicReady, setMusicReady] = useState(false)

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

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-gray-950 transition-colors">
      <TopBar onOpenSettings={onOpenSettings} />

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
