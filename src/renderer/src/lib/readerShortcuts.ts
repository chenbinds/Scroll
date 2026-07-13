/** Skip reader page-turn / scroll shortcuts when focus is in chrome controls. */
export function shouldIgnoreReaderShortcut(e: KeyboardEvent): boolean {
  const el = e.target
  if (!(el instanceof HTMLElement)) return false
  if (el.closest('[data-music-player]')) return true
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return true
  if (el.isContentEditable) return true
  return false
}
