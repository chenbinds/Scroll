import { useEffect, type RefObject } from 'react'
import { useAppStore } from '../stores/appStore'
import { jumpToSearchHit } from './bookSearch'

/** Listen for pendingSearchHit and scroll+highlight inside the reader scroll container. */
export function useSearchHitNavigation(scrollRef: RefObject<HTMLDivElement | null>): void {
  const pendingSearchHit = useAppStore((s) => s.pendingSearchHit)
  const clearPendingSearchHit = useAppStore((s) => s.clearPendingSearchHit)

  useEffect(() => {
    if (!pendingSearchHit) return
    const el = scrollRef.current
    if (!el) {
      clearPendingSearchHit()
      return
    }
    // Allow layout to settle after chapter paint
    const t = window.setTimeout(() => {
      jumpToSearchHit(el, pendingSearchHit)
      clearPendingSearchHit()
    }, 50)
    return () => clearTimeout(t)
  }, [pendingSearchHit, clearPendingSearchHit, scrollRef])
}
