/**
 * Minimal EPUB parser using JSZip
 * Extracts metadata, TOC, and spine HTML content directly from the ZIP archive.
 * No epub.js dependency — works reliably in Electron.
 */

import JSZip from 'jszip'

export interface EpubMetadata {
  title: string
  author: string
}

export interface TocItem {
  label: string
  href: string
  spineIndex: number // maps directly to spine array index for reliable navigation
  subitems?: TocItem[]
}

export interface EpubContent {
  metadata: EpubMetadata
  toc: TocItem[]
  spine: { id: string; href: string }[]
  files: Map<string, string> // href -> HTML content (with resolved image data URLs)
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'])

export async function parseEpub(base64Data: string): Promise<EpubContent> {
  const binaryStr = atob(base64Data)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)

  const zip = await JSZip.loadAsync(bytes)

  // Extract all images from ZIP as base64 data URLs
  const imageDataUrls = new Map<string, string>()
  const imgPromises: Promise<void>[] = []
  zip.forEach((relativePath, file) => {
    const ext = relativePath.split('.').pop()?.toLowerCase() || ''
    if (IMAGE_EXTS.has(ext)) {
      imgPromises.push(
        file.async('base64').then((b64) => {
          const mime = ext === 'jpg' ? 'jpeg' : ext === 'svg' ? 'svg+xml' : ext
          imageDataUrls.set(relativePath, `data:image/${mime};base64,${b64}`)
        })
      )
    }
  })
  await Promise.all(imgPromises)

  // Find container.xml
  const containerFile = zip.file('META-INF/container.xml')
  if (!containerFile) throw new Error('Not a valid EPUB: missing container.xml')

  const containerXml = await containerFile.async('text')
  const opfPath = parseContainerXml(containerXml)
  if (!opfPath) throw new Error('Cannot find OPF path in container.xml')

  // Find and parse OPF
  const opfFile = zip.file(opfPath)
  if (!opfFile) throw new Error(`OPF file not found: ${opfPath}`)

  const opfXml = await opfFile.async('text')
  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : ''

  const { metadata, manifest, spine } = parseOpf(opfXml, opfDir)

  // Build resolved spine array (id + resolved href)
  const resolvedSpine = spine.map((s) => ({
    id: s.id,
    href: manifest.find((m) => m.id === s.id)?.href || ''
  }))

  // Load spine HTML files, resolve image src to data URLs
  const files = new Map<string, string>()
  for (const item of resolvedSpine) {
    const htmlFile = zip.file(item.href)
    if (!htmlFile) continue
    try {
      let html = await htmlFile.async('text')
      const chapterDir = item.href.includes('/')
        ? item.href.substring(0, item.href.lastIndexOf('/') + 1)
        : ''

      // Generic resolver for any image reference
      const resolveUrl = (attrValue: string): string | null => {
        const cleanPath = attrValue.split('#')[0].split('?')[0]
        if (!cleanPath) return null

        // Strategy 1: Exact match
        if (imageDataUrls.has(cleanPath)) return imageDataUrls.get(cleanPath)!

        // Strategy 2: Chapter-relative path
        if (chapterDir) {
          const resolved = chapterDir + cleanPath.replace(/^\.\//, '')
          if (imageDataUrls.has(resolved)) return imageDataUrls.get(resolved)!
          const normalized = resolveRelative(chapterDir, cleanPath)
          if (imageDataUrls.has(normalized)) return imageDataUrls.get(normalized)!
        }

        // Strategy 3: Match by filename only
        const targetFile = cleanPath.split('/').pop() || cleanPath
        for (const [imgPath, dataUrl] of imageDataUrls) {
          const imgFile = imgPath.split('/').pop() || imgPath
          if (imgFile === targetFile) return dataUrl
        }

        // Strategy 4: Ends-with match
        for (const [imgPath, dataUrl] of imageDataUrls) {
          if (imgPath.endsWith('/' + cleanPath) || imgPath === cleanPath) return dataUrl
        }

        return null
      }

      html = html.replace(/\b(src|href|xlink:href)=["']([^"']+)["']/gi,
        (_full: string, attr: string, value: string) => {
          const dataUrl = resolveUrl(value)
          return dataUrl ? `${attr}="${dataUrl}"` : _full
        })
      files.set(item.href, html)
    } catch {
      // skip files that fail to load
    }
  }

  // Build TOC — resolve NCX paths relative to NCX file location
  let toc: TocItem[] = []
  const ncxFiles = Object.keys(zip.files).filter((f) => f.endsWith('.ncx'))
  if (ncxFiles.length > 0) {
    const ncxPath = ncxFiles[0]
    const ncxDir = ncxPath.includes('/') ? ncxPath.substring(0, ncxPath.lastIndexOf('/') + 1) : ''
    const ncxFile = zip.file(ncxPath)
    if (ncxFile) {
      const ncxXml = await ncxFile.async('text')
      toc = parseNcx(ncxXml, ncxDir)
    }
  }

  // If no NCX TOC, generate from spine
  if (toc.length === 0) {
    toc = resolvedSpine.map((s, i) => ({
      label: `Chapter ${i + 1}`,
      href: s.href,
      spineIndex: i
    }))
  }

  // Match each TOC item to its spine index by comparing resolved hrefs
  for (const item of toc) {
    if (item.spineIndex !== undefined) continue // already set

    const tocHref = item.href.replace(/#.*$/, '') // strip fragment
    // Find matching spine entry (exact match first, then filename match)
    let matchedIndex = resolvedSpine.findIndex(
      (s) => s.href === tocHref || s.href === item.href
    )
    if (matchedIndex < 0) {
      const tocFile = tocHref.split('/').pop() || ''
      matchedIndex = resolvedSpine.findIndex(
        (s) => (s.href.split('/').pop() || '') === tocFile
      )
    }
    item.spineIndex = matchedIndex >= 0 ? matchedIndex : 0
    // Also fix subitems
    if (item.subitems) {
      for (const sub of item.subitems) {
        const subHref = sub.href.replace(/#.*$/, '')
        let subIdx = resolvedSpine.findIndex(
          (s) => s.href === subHref || s.href === sub.href
        )
        if (subIdx < 0) {
          const subFile = subHref.split('/').pop() || ''
          subIdx = resolvedSpine.findIndex(
            (s) => (s.href.split('/').pop() || '') === subFile
          )
        }
        sub.spineIndex = subIdx >= 0 ? subIdx : 0
      }
    }
  }

  return {
    metadata: {
      title: metadata.title || 'Untitled',
      author: metadata.creator || 'Unknown Author'
    },
    toc,
    spine: resolvedSpine,
    files
  }
}

function parseContainerXml(xml: string): string | null {
  const match = xml.match(/full-path="([^"]+)"/)
  return match ? match[1] : null
}

function parseOpf(xml: string, baseDir: string): {
  metadata: Record<string, string>
  manifest: { id: string; href: string; mediaType: string }[]
  spine: { id: string }[]
} {
  const metadata: Record<string, string> = {}
  const titleMatch = xml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/)
  if (titleMatch) metadata.title = titleMatch[1]
  const creatorMatch = xml.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/)
  if (creatorMatch) metadata.creator = creatorMatch[1]

  const manifest: { id: string; href: string; mediaType: string }[] = []
  const itemRegex = /<item[^>]*>/g
  let m: RegExpExecArray | null
  while ((m = itemRegex.exec(xml)) !== null) {
    const idMatch = m[0].match(/id="([^"]+)"/)
    const hrefMatch = m[0].match(/href="([^"]+)"/)
    const typeMatch = m[0].match(/media-type="([^"]+)"/)
    if (idMatch && hrefMatch) {
      manifest.push({
        id: idMatch[1],
        href: typeMatch && typeMatch[1] === 'application/xhtml+xml' ? baseDir + hrefMatch[1] : hrefMatch[1],
        mediaType: typeMatch ? typeMatch[1] : ''
      })
    }
  }

  const spine: { id: string }[] = []
  const spineMatch = xml.match(/<spine[^>]*>([\s\S]*?)<\/spine>/)
  if (spineMatch) {
    const refRegex = /<itemref[^>]*idref="([^"]+)"/g
    let s: RegExpExecArray | null
    while ((s = refRegex.exec(spineMatch[1])) !== null) {
      spine.push({ id: s[1] })
    }
  }

  return { metadata, manifest, spine }
}

function resolveRelative(base: string, rel: string): string {
  const parts = base.replace(/\/$/, '').split('/')
  parts.pop() // remove filename part
  for (const seg of rel.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.') parts.push(seg)
  }
  return parts.join('/')
}

function parseNcx(xml: string, baseDir: string): TocItem[] {
  const items: TocItem[] = []
  const navMapMatch = xml.match(/<navMap>([\s\S]*?)<\/navMap>/)
  if (!navMapMatch) return items

  const navPointRegex = /<navPoint[^>]*>([\s\S]*?)<\/navPoint>/g
  let np: RegExpExecArray | null
  while ((np = navPointRegex.exec(navMapMatch[1])) !== null) {
    const labelMatch = np[1].match(/<text>([^<]+)<\/text>/)
    const srcMatch = np[1].match(/src="([^"]+)"/)
    if (labelMatch && srcMatch) {
      // Resolve relative to NCX file location, then strip fragment for matching
      const resolvedHref = resolveRelative(baseDir, srcMatch[1])
      items.push({
        label: labelMatch[1],
        href: resolvedHref,
        spineIndex: -1 // will be resolved later
      })
    }
  }

  return items
}
