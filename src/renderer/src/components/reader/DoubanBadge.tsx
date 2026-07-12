import { useState, useEffect } from 'react'
import { Star, ExternalLink } from 'lucide-react'

interface Props { title: string; author?: string }

interface DoubanInfo { rating: number; url: string; pub?: string }

export default function DoubanBadge({ title, author }: Props) {
  const [info, setInfo] = useState<DoubanInfo | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    window.scrollAPI.doubanSearch(title, author).then((result) => {
      if (result) setInfo(result)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [title, author])

  if (loading && !info) {
    return <span className="text-[10px] text-gray-400 animate-pulse">豆瓣...</span>
  }
  if (!info) return null

  return (
    <a
      href={info.url}
      title={info.pub ? `出版: ${info.pub}` : '在豆瓣查看'}
      onClick={(e) => { e.stopPropagation() }}
      className="flex items-center gap-1 text-[11px] no-underline
                 text-yellow-600 dark:text-yellow-500 hover:opacity-80 transition-opacity flex-shrink-0"
    >
      <Star size={12} fill="currentColor" />
      <span className="font-medium">{info.rating.toFixed(1)}</span>
      <ExternalLink size={10} className="opacity-50" />
    </a>
  )
}
