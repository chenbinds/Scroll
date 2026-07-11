import { type ReactNode } from 'react'
import { useAppStore } from '../../stores/appStore'
import TopBar from './TopBar'
import LeftSidebar from './LeftSidebar'
import RightSidebar from './RightSidebar'
import MusicPlayer from '../music/MusicPlayer'

interface Props {
  children: ReactNode
  onOpenSettings: () => void
}

export default function AppShell({ children, onOpenSettings }: Props) {
  const { leftSidebarOpen, rightSidebarOpen, currentView } = useAppStore()

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-950 transition-colors">
      <TopBar onOpenSettings={onOpenSettings} />

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar: TOC + Bookmarks */}
        {currentView === 'reader' && leftSidebarOpen && <LeftSidebar />}

        {/* Main content */}
        <main className="flex-1 overflow-hidden">{children}</main>

        {/* Right sidebar: AI */}
        {currentView === 'reader' && rightSidebarOpen && <RightSidebar />}
      </div>

      <MusicPlayer />
    </div>
  )
}
