import { useEffect, useRef, type RefObject } from 'react'
import { useAppStore } from '../stores/appStore'
import { restoreScrollByTextOffset } from './readingAnchor'

/**
 * Re-pin scroll to last text offset when font size or sidebars change layout.
 * Also handles navigateToTextOffset jumps (bookmarks).
 */
export function useAnchorLayoutPin(
  contentRef: RefObject<HTMLElement | null>,
  options: {
    ready: boolean
    fontSize: number
    lastTextOffsetRef: RefObject<number | null>
    restoringRef: { current: boolean }
  }
): void {
  const { ready, fontSize, lastTextOffsetRef, restoringRef } = options
  const leftSidebarOpen = useAppStore((s) => s.leftSidebarOpen)
  const rightSidebarOpen = useAppStore((s) => s.rightSidebarOpen)
  const skipFirstLayoutRef = useRef(true)

  useEffect(() => {
    if (!ready) return
    if (skipFirstLayoutRef.current) {
      skipFirstLayoutRef.current = false
      return
    }
    const offset = lastTextOffsetRef.current
    if (offset == null || offset < 0) return
    restoringRef.current = true
    const stop = restoreScrollByTextOffset(() => contentRef.current, offset, { maxMs: 2000 })
    const t = setTimeout(() => {
      restoringRef.current = false
    }, 2100)
    return () => {
      stop()
      clearTimeout(t)
      restoringRef.current = false
    }
  }, [ready, fontSize, leftSidebarOpen, rightSidebarOpen, contentRef, lastTextOffsetRef, restoringRef])

  const navigateToTextOffset = useAppStore((s) => s.navigateToTextOffset)
  const setNavigateToTextOffset = useAppStore((s) => s.setNavigateToTextOffset)

  useEffect(() => {
    if (navigateToTextOffset == null || !contentRef.current) return
    restoringRef.current = true
    lastTextOffsetRef.current = navigateToTextOffset
    const stop = restoreScrollByTextOffset(() => contentRef.current, navigateToTextOffset, {
      maxMs: 1500
    })
    setNavigateToTextOffset(null)
    const t = setTimeout(() => {
      restoringRef.current = false
    }, 1600)
    return () => {
      stop()
      clearTimeout(t)
      restoringRef.current = false
    }
  }, [
    navigateToTextOffset,
    setNavigateToTextOffset,
    contentRef,
    lastTextOffsetRef,
    restoringRef
  ])
}
