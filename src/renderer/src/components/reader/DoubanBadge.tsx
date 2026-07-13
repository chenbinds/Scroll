import { Star, RefreshCw } from 'lucide-react'
import { useState } from 'react'

interface Props {
  rating?: number | null
  title: string
  author?: string
  onRefresh?: () => void | Promise<void>
}

/** Shows stored Douban rating; refresh only when user clicks. */
export default function DoubanBadge({ rating, title, author, onRefresh }: Props) {
  const [busy, setBusy] = useState(false)
  const hasRating = rating != null && rating > 0

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!onRefresh || busy) return
    setBusy(true)
    try {
      await onRefresh()
    } finally {
      setBusy(false)
    }
  }

  if (!hasRating && !onRefresh) return null

  return (
    <span className="flex items-center gap-1 text-[11px] text-yellow-600 dark:text-yellow-500 flex-shrink-0">
      {hasRating ? (
        <>
          <Star size={12} fill="currentColor" />
          <span className="font-medium">{rating!.toFixed(1)}</span>
        </>
      ) : (
        <span className="text-gray-400">豆瓣</span>
      )}
      {onRefresh && (
        <button
          type="button"
          onClick={handleRefresh}
          disabled={busy}
          title={`更新豆瓣评分：${title}${author ? ' / ' + author : ''}`}
          className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
          {busy ? <RefreshCw size={10} className="animate-spin" /> : <RefreshCw size={10} className="opacity-50" />}
        </button>
      )}
    </span>
  )
}
