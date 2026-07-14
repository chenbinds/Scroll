import { useEffect, useRef } from 'react'
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useI18n } from '../../lib/i18n'
import { SEARCH_HIT_LIMIT } from '../../lib/bookSearch'

export default function SearchPanel() {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const searchQuery = useAppStore((s) => s.searchQuery)
  const searchHits = useAppStore((s) => s.searchHits)
  const activeHitIndex = useAppStore((s) => s.activeHitIndex)
  const searchChapters = useAppStore((s) => s.searchChapters)
  const searchFocusNonce = useAppStore((s) => s.searchFocusNonce)
  const setSearchQuery = useAppStore((s) => s.setSearchQuery)
  const runSearch = useAppStore((s) => s.runSearch)
  const goToSearchHit = useAppStore((s) => s.goToSearchHit)
  const clearSearch = useAppStore((s) => s.clearSearch)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [searchFocusNonce])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    runSearch(searchQuery)
  }

  const hasIndex = searchChapters.length > 0
  const hitCount = searchHits.length
  const capped = hitCount >= SEARCH_HIT_LIMIT

  return (
    <div className="flex flex-col h-full">
      <form onSubmit={onSubmit} className="p-3 border-b border-gray-200 dark:border-gray-800 space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={inputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            disabled={!hasIndex}
            className="w-full pl-8 pr-8 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700
                       bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200
                       outline-none focus:ring-1 focus:ring-scroll-400 disabled:opacity-50"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => clearSearch()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
              aria-label={t('search.clear')}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            type="submit"
            disabled={!hasIndex || !searchQuery.trim()}
            className="px-3 py-1.5 text-xs rounded-md bg-scroll-500 text-white hover:bg-scroll-600
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {t('search.submit')}
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={hitCount === 0}
              onClick={() => {
                const next = activeHitIndex <= 0 ? hitCount - 1 : activeHitIndex - 1
                goToSearchHit(next)
              }}
              className="p-1.5 rounded chrome-muted hover:opacity-80 disabled:opacity-30"
              title={t('search.prev')}
            >
              <ChevronUp size={16} />
            </button>
            <button
              type="button"
              disabled={hitCount === 0}
              onClick={() => {
                const next = activeHitIndex >= hitCount - 1 ? 0 : activeHitIndex + 1
                goToSearchHit(next)
              }}
              className="p-1.5 rounded chrome-muted hover:opacity-80 disabled:opacity-30"
              title={t('search.next')}
            >
              <ChevronDown size={16} />
            </button>
            <span className="text-[11px] text-gray-400 tabular-nums min-w-[3.5rem] text-right">
              {hitCount === 0
                ? '0'
                : `${activeHitIndex + 1}/${hitCount}${capped ? '+' : ''}`}
            </span>
          </div>
        </div>
      </form>

      <div className="flex-1 overflow-y-auto">
        {!hasIndex && (
          <p className="p-4 text-sm text-gray-400 dark:text-gray-600">{t('search.unavailable')}</p>
        )}
        {hasIndex && !searchQuery.trim() && hitCount === 0 && (
          <p className="p-4 text-sm text-gray-400 dark:text-gray-600">{t('search.hint')}</p>
        )}
        {hasIndex && searchQuery.trim() && hitCount === 0 && (
          <p className="p-4 text-sm text-gray-400 dark:text-gray-600">{t('search.empty')}</p>
        )}
        {searchHits.map((hit, i) => (
          <button
            key={`${hit.chapterIndex}-${hit.start}-${i}`}
            type="button"
            onClick={() => goToSearchHit(i)}
            className={`w-full text-left px-3 py-2.5 border-b border-gray-100 dark:border-gray-800/50
                       transition-colors ${
                         i === activeHitIndex
                           ? 'bg-scroll-50 dark:bg-scroll-900/30'
                           : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
                       }`}
          >
            <p className="text-[11px] text-scroll-600 dark:text-scroll-400 truncate mb-0.5">
              {hit.chapterTitle || `${t('bookmarks.chapter')} ${hit.chapterIndex + 1}`}
            </p>
            <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2 leading-snug">
              {hit.snippet}
            </p>
          </button>
        ))}
        {capped && (
          <p className="px-3 py-2 text-[11px] text-gray-400">{t('search.capped')}</p>
        )}
      </div>
    </div>
  )
}
