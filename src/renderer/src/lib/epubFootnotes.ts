/**
 * Mark EPUB/MOBI footnote bodies so reader CSS can hide them.
 * Books often place footnote HTML inline after noteref and rely on
 * chapter <style> { display:none }; we strip those styles on load.
 */

function decodeFrag(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function epubTypeOf(el: Element): string {
  return (el.getAttribute('epub:type') || el.getAttribute('type') || '').toLowerCase()
}

function isNoterefAnchor(el: Element): boolean {
  if (el.tagName !== 'A') return false
  if (/\bnoteref\b/.test(epubTypeOf(el))) return true
  const cls = typeof (el as HTMLElement).className === 'string' ? (el as HTMLElement).className : ''
  return /\b(duokan-footnote|footnote-ref|noteref)\b/i.test(cls)
}

function isFootnoteBody(el: Element): boolean {
  const type = epubTypeOf(el)
  if (/\b(footnote|endnote|rearnote)\b/.test(type) && !/\bnoteref\b/.test(type)) return true
  const role = (el.getAttribute('role') || '').toLowerCase()
  if (role === 'doc-footnote' || role === 'doc-endnote') return true
  const cls = typeof (el as HTMLElement).className === 'string' ? (el as HTMLElement).className : ''
  if (/\b(duokan-footnote-content|footnote-content|footnote-item|kindle-footnote)\b/i.test(cls)) {
    return true
  }
  if (/\bfootnote\b/i.test(cls) && !/\b(noteref|footnote-ref|duokan-footnote)\b/i.test(cls)) {
    const tag = el.tagName
    return (
      tag === 'ASIDE' ||
      tag === 'DIV' ||
      tag === 'SECTION' ||
      tag === 'LI' ||
      tag === 'P' ||
      tag === 'OL' ||
      tag === 'UL' ||
      tag === 'SPAN'
    )
  }
  return false
}

/** Tag known / noteref-linked footnote nodes with data-scroll-footnote="1". */
export function markInlineFootnotes(html: string): string {
  if (!html || typeof DOMParser === 'undefined') return html
  try {
    const doc = new DOMParser().parseFromString(
      `<div id="scroll-fn-root">${html}</div>`,
      'text/html'
    )
    const root = doc.getElementById('scroll-fn-root')
    if (!root) return html

    // Semantic footnote bodies
    root
      .querySelectorAll(
        'aside[epub\\:type], [epub\\:type], [role="doc-footnote"], [role="doc-endnote"], ' +
          '.duokan-footnote-content, .footnote-content, .footnote-item, .kindle-footnote, ' +
          'aside.footnote, div.footnote, section.footnote, ol.footnote, ul.footnote, li.footnote, p.footnote, span.footnote'
      )
      .forEach((el) => {
        if (isFootnoteBody(el)) el.setAttribute('data-scroll-footnote', '1')
      })

    // Targets of noteref / duokan-footnote links (do not mark TOC #section targets)
    root.querySelectorAll('a[href*="#"]').forEach((a) => {
      const href = a.getAttribute('href') || ''
      const hashIdx = href.indexOf('#')
      if (hashIdx < 0 || hashIdx >= href.length - 1) return
      const frag = decodeFrag(href.slice(hashIdx + 1))
      if (!frag) return
      let target: Element | null = null
      try {
        target = root.querySelector(`#${CSS.escape(frag)}`)
      } catch {
        target = null
      }
      if (!target || target === a) return

      if (isNoterefAnchor(a) || isFootnoteBody(target)) {
        target.setAttribute('data-scroll-footnote', '1')
      }
    })

    return root.innerHTML
  } catch {
    return html
  }
}
