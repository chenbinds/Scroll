/**
 * Intercept in-content EPUB/MOBI links so they never navigate the BrowserWindow
 * (default <a href="chapter.xhtml"> wipes the React SPA → white screen).
 * Footnote noteref → popup (book CSS that hid footnotes is stripped).
 */

function decodeFrag(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function resolveRelative(baseDir: string, rel: string): string {
  const dir = baseDir.replace(/\/$/, '')
  const parts = dir ? dir.split('/') : []
  for (const seg of rel.replace(/^\.\//, '').split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.' && seg !== '') parts.push(seg)
  }
  return parts.join('/')
}

function basename(path: string): string {
  const clean = path.split('?')[0]
  return clean.split('/').pop() || clean
}

function findFragmentTarget(scope: ParentNode, fragment: string): HTMLElement | null {
  try {
    const id = CSS.escape(fragment)
    return (
      (scope.querySelector(`#${id}`) as HTMLElement | null) ||
      (scope.querySelector(`[name="${id}"]`) as HTMLElement | null) ||
      (scope.querySelector(`a[id="${id}"]`) as HTMLElement | null)
    )
  } catch {
    return null
  }
}

/** Match spine section for a relative/absolute-in-epub path. */
function findChapterByHref(readerEl: HTMLElement, pathPart: string, baseHref?: string): HTMLElement | null {
  let resolved = pathPart.replace(/^\.\//, '')
  if (baseHref) {
    const baseDir = baseHref.includes('/')
      ? baseHref.slice(0, baseHref.lastIndexOf('/') + 1)
      : ''
    resolved = resolveRelative(baseDir, pathPart)
  }

  const candidates = [resolved, pathPart, basename(resolved), basename(pathPart)].filter(Boolean)
  const sections = readerEl.querySelectorAll('[data-href]')

  for (const s of sections) {
    const h = (s as HTMLElement).dataset.href || ''
    if (!h) continue
    if (candidates.includes(h)) return s as HTMLElement
    if (candidates.some((c) => h.endsWith('/' + c) || h === c || basename(h) === c)) {
      return s as HTMLElement
    }
  }
  return null
}

function epubTypeOf(el: HTMLElement): string {
  return (
    el.getAttribute('epub:type') ||
    el.getAttribute('type') ||
    ''
  ).toLowerCase()
}

function isFootnoteElement(el: HTMLElement): boolean {
  if (el.getAttribute('data-scroll-footnote') === '1') return true
  const type = epubTypeOf(el)
  if (/\b(footnote|endnote|rearnote)\b/.test(type) && !/\bnoteref\b/.test(type)) return true
  const role = (el.getAttribute('role') || '').toLowerCase()
  if (role === 'doc-footnote' || role === 'doc-endnote') return true
  const cls = typeof el.className === 'string' ? el.className : ''
  if (/\b(duokan-footnote-content|footnote-content|footnote-item|kindle-footnote)\b/i.test(cls)) {
    return true
  }
  if (/\bfootnote\b/i.test(cls) && !/\b(noteref|footnote-ref|duokan-footnote)\b/i.test(cls)) {
    const tag = el.tagName
    if (tag === 'ASIDE' || tag === 'DIV' || tag === 'SECTION' || tag === 'LI' || tag === 'P' || tag === 'OL' || tag === 'UL') {
      return true
    }
  }
  return false
}

function isNoterefAnchor(anchor: HTMLAnchorElement): boolean {
  const type = epubTypeOf(anchor)
  if (/\bnoteref\b/.test(type)) return true
  const cls = typeof anchor.className === 'string' ? anchor.className : ''
  if (/\b(duokan-footnote|footnote-ref|noteref)\b/i.test(cls)) return true
  return false
}

let activeFootnotePopup: HTMLElement | null = null
let footnoteOutsideHandler: ((e: Event) => void) | null = null

function dismissFootnotePopup(): void {
  if (activeFootnotePopup) {
    activeFootnotePopup.remove()
    activeFootnotePopup = null
  }
  if (footnoteOutsideHandler) {
    document.removeEventListener('mousedown', footnoteOutsideHandler, true)
    document.removeEventListener('keydown', footnoteOutsideHandler, true)
    footnoteOutsideHandler = null
  }
}

function showFootnotePopup(anchor: HTMLAnchorElement, text: string): void {
  dismissFootnotePopup()
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return

  const rect = anchor.getBoundingClientRect()
  const popup = document.createElement('div')
  popup.setAttribute('role', 'dialog')
  popup.className =
    'scroll-footnote-popup fixed z-[70] max-w-[min(360px,92vw)] max-h-[240px] overflow-auto ' +
    'rounded-lg shadow-lg border px-3 py-2.5 text-sm leading-relaxed'
  popup.style.left = `${Math.min(rect.left, window.innerWidth - 280)}px`
  popup.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - 80)}px`
  popup.style.background = 'var(--reader-surface, #fff)'
  popup.style.color = 'var(--reader-text, #111)'
  popup.style.borderColor = 'var(--reader-border, #e5e7eb)'
  popup.textContent = cleaned
  document.body.appendChild(popup)
  activeFootnotePopup = popup

  // Clamp after measure
  const pr = popup.getBoundingClientRect()
  if (pr.right > window.innerWidth - 8) {
    popup.style.left = `${Math.max(8, window.innerWidth - pr.width - 8)}px`
  }
  if (pr.bottom > window.innerHeight - 8) {
    popup.style.top = `${Math.max(8, rect.top - pr.height - 8)}px`
  }

  footnoteOutsideHandler = (e: Event) => {
    if (e instanceof KeyboardEvent && e.key === 'Escape') {
      dismissFootnotePopup()
      return
    }
    if (e instanceof MouseEvent) {
      const t = e.target
      if (t instanceof Node && (popup.contains(t) || anchor.contains(t))) return
      dismissFootnotePopup()
    }
  }
  document.addEventListener('mousedown', footnoteOutsideHandler, true)
  document.addEventListener('keydown', footnoteOutsideHandler, true)
}

function tryShowFootnoteFromHref(
  readerEl: HTMLElement,
  href: string,
  baseHref: string | undefined,
  anchor: HTMLAnchorElement
): boolean {
  const hashIdx = href.indexOf('#')
  if (hashIdx < 0 || hashIdx >= href.length - 1) return false
  const pathPart = href.slice(0, hashIdx).trim()
  const fragment = decodeFrag(href.slice(hashIdx + 1))
  if (!fragment) return false

  let scope: ParentNode = readerEl
  if (pathPart && pathPart !== '.') {
    const chapter = findChapterByHref(readerEl, pathPart, baseHref)
    if (chapter) scope = chapter
  }

  const target = findFragmentTarget(scope, fragment)
  if (!target) return false
  if (!isFootnoteElement(target) && !isNoterefAnchor(anchor)) return false
  // Prefer popup when target looks like footnote, or when link is explicitly a noteref
  if (!isFootnoteElement(target) && isNoterefAnchor(anchor)) {
    // noteref pointing at non-classified node — still show if it's a small annotation block
    const text = target.textContent || ''
    if (text.trim().length > 800) return false
  } else if (!isFootnoteElement(target)) {
    return false
  }

  showFootnotePopup(anchor, target.textContent || '')
  return true
}

/**
 * Scroll reader to an EPUB-style href (path and/or #fragment).
 * Used by sidebar TOC and in-content link clicks.
 */
export function scrollReaderToHref(
  readerEl: HTMLElement,
  href: string,
  baseHref?: string
): boolean {
  if (!href || href.startsWith('javascript:') || href.startsWith('data:')) return false

  const hashIdx = href.indexOf('#')
  const pathPart = (hashIdx >= 0 ? href.slice(0, hashIdx) : href).trim()
  const fragment =
    hashIdx >= 0 && hashIdx < href.length - 1 ? decodeFrag(href.slice(hashIdx + 1)) : null

  let scope: ParentNode = readerEl

  if (pathPart && pathPart !== '.') {
    const chapter = findChapterByHref(readerEl, pathPart, baseHref)
    if (chapter) {
      scope = chapter
    } else if (!fragment) {
      return false
    }
    // path not found but has fragment → search whole document
  }

  if (fragment) {
    const target = findFragmentTarget(scope, fragment)
    if (target) {
      if (isFootnoteElement(target)) {
        // Hidden footnotes: don't scroll into empty space
        return false
      }
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return true
    }
    // Fragment missing: fall through to chapter start if we resolved one
    if (scope !== readerEl) {
      ;(scope as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' })
      return true
    }
    return false
  }

  if (scope !== readerEl) {
    ;(scope as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' })
    return true
  }
  return false
}

function isExternalHref(href: string): boolean {
  return /^(https?:|mailto:|ftp:)/i.test(href)
}

/**
 * Attach click interceptor on the scroll container. Returns cleanup.
 */
export function attachReaderLinkInterceptor(readerEl: HTMLElement): () => void {
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented) return
    if (e.button !== 0) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

    const target = e.target
    if (!(target instanceof Element)) return

    const anchor = target.closest('a[href]') as HTMLAnchorElement | null
    if (!anchor || !readerEl.contains(anchor)) return

    const href = (anchor.getAttribute('href') || '').trim()
    if (!href) {
      e.preventDefault()
      return
    }

    // Always block default — relative chapter links leave the SPA blank
    e.preventDefault()
    e.stopPropagation()

    if (href.startsWith('javascript:') || href.startsWith('data:')) return

    if (isExternalHref(href)) {
      void window.scrollAPI?.openExternal?.(href)
      return
    }

    const section = anchor.closest('[data-href]') as HTMLElement | null
    const baseHref = section?.dataset.href

    if (tryShowFootnoteFromHref(readerEl, href, baseHref, anchor)) return

    scrollReaderToHref(readerEl, href, baseHref)
  }

  const onScroll = () => dismissFootnotePopup()

  readerEl.addEventListener('click', onClick)
  readerEl.addEventListener('scroll', onScroll, { passive: true })
  return () => {
    readerEl.removeEventListener('click', onClick)
    readerEl.removeEventListener('scroll', onScroll)
    dismissFootnotePopup()
  }
}
