/**
 * MOBI/AZW3 parser powered by foliate-js (same engine as Koodo Reader).
 * https://github.com/johnfactotum/foliate-js
 */

import { MOBI } from 'foliate-js/mobi.js'
import { unzlibSync } from 'fflate'
import { cleanBookTitle } from './bookTitle'
import { compressCoverDataUrl } from './coverImage'

export interface MobiChapter {
  title: string
  html: string
}

export interface MobiContent {
  metadata: { title: string; author: string }
  chapters: MobiChapter[]
  coverUrl?: string
  /** Revoke blob URLs created while parsing (images / cover). */
  destroy: () => void
}

interface FoliateTocItem {
  label?: string
  href?: string
  subitems?: FoliateTocItem[]
}

interface FoliateSection {
  id?: number
  linear?: string
  load?: () => Promise<string>
  createDocument?: () => Promise<Document>
  size?: number
}

interface FoliateBook {
  sections: FoliateSection[]
  toc?: FoliateTocItem[]
  metadata: {
    title?: string
    author?: string | string[]
  }
  getCover?: () => Promise<Blob | null | undefined>
  splitTOCHref?: (href: string) => [number, unknown] | number[]
  destroy?: () => void
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function base64ToFile(base64: string, name: string): File {
  const bytes = base64ToUint8Array(base64)
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new File([copy], name)
}

function authorFromMeta(author: string | string[] | undefined): string {
  if (!author) return 'Unknown Author'
  if (Array.isArray(author)) {
    const joined = author.filter(Boolean).join(', ').trim()
    return joined || 'Unknown Author'
  }
  return author.trim() || 'Unknown Author'
}

function extractBodyHtml(docHtml: string): string {
  try {
    const doc = new DOMParser().parseFromString(docHtml, 'text/html')
    const body = doc.body
    if (!body) return docHtml
    // Drop default injected stylesheets — reader chrome owns typography
    body.querySelectorAll('style').forEach((el) => el.remove())
    return body.innerHTML
  } catch {
    return docHtml
  }
}

function collectSectionTitles(book: FoliateBook, sectionCount: number): string[] {
  const titles = Array.from({ length: sectionCount }, () => '')
  if (!book.toc?.length || !book.splitTOCHref) return titles

  const walk = (items: FoliateTocItem[]) => {
    for (const item of items) {
      if (item.href) {
        try {
          const result = book.splitTOCHref!(item.href)
          const index = Array.isArray(result) ? result[0] : -1
          if (typeof index === 'number' && index >= 0 && index < sectionCount && !titles[index]) {
            const label = (item.label || '').trim()
            if (label) titles[index] = label
          }
        } catch {
          // ignore broken TOC hrefs
        }
      }
      if (item.subitems?.length) walk(item.subitems)
    }
  }
  walk(book.toc)
  return titles
}

/** Lightweight cover-only extract for library import. */
export async function extractMobiCover(base64Data: string): Promise<string | undefined> {
  const file = base64ToFile(base64Data, 'book.mobi')
  const parser = new MOBI({ unzlib: unzlibSync })
  const book = (await parser.open(file)) as FoliateBook
  try {
    const blob = await book.getCover?.()
    if (!blob) return undefined
    const raw = await blobToDataUrl(blob)
    return compressCoverDataUrl(raw)
  } finally {
    book.destroy?.()
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error || new Error('Failed to read cover'))
    reader.readAsDataURL(blob)
  })
}

export async function parseMobi(base64Data: string): Promise<MobiContent> {
  const file = base64ToFile(base64Data, 'book.mobi')
  const parser = new MOBI({ unzlib: unzlibSync })
  const book = (await parser.open(file)) as FoliateBook

  try {
    const title = cleanBookTitle((book.metadata?.title || '').trim() || 'Untitled')
    const author = authorFromMeta(book.metadata?.author)

    let coverUrl: string | undefined
    try {
      const coverBlob = await book.getCover?.()
      if (coverBlob) coverUrl = await compressCoverDataUrl(await blobToDataUrl(coverBlob))
    } catch {
      // cover optional
    }

    const sections = (book.sections || []).filter(
      (s) => s && s.linear !== 'no' && typeof s.load === 'function'
    )
    const tocTitles = collectSectionTitles(book, sections.length)

    const chapters: MobiChapter[] = []
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i]
      const url = await section.load!()
      const rawHtml = await (await fetch(url)).text()
      const html = extractBodyHtml(rawHtml)
      const chapterTitle = tocTitles[i] || `Section ${i + 1}`
      chapters.push({ title: chapterTitle, html })
    }

    if (chapters.length === 0) {
      throw new Error('No readable sections found in MOBI/AZW3 file')
    }

    return {
      metadata: { title, author },
      chapters,
      coverUrl,
      destroy: () => {
        book.destroy?.()
      }
    }
  } catch (err) {
    book.destroy?.()
    throw err
  }
}
