/**
 * Intercept in-content EPUB/MOBI links so they never navigate the BrowserWindow
 * (default <a href="chapter.xhtml"> wipes the React SPA → white screen).
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
    scrollReaderToHref(readerEl, href, section?.dataset.href)
  }

  readerEl.addEventListener('click', onClick)
  return () => readerEl.removeEventListener('click', onClick)
}
