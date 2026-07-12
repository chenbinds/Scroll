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
  spineIndex: number
  subitems?: TocItem[]
}

export interface EpubContent {
  metadata: EpubMetadata
  toc: TocItem[]
  spine: { id: string; href: string }[]
  files: Map<string, string>
  coverUrl?: string
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'])

/** Lightweight: extract only the cover image from an EPUB — no full parse */
export async function extractEpubCover(base64Data: string): Promise<string | undefined> {
  try {
    const binaryStr = atob(base64Data)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
    const zip = await JSZip.loadAsync(bytes)

    // Find OPF
    const containerFile = zip.file('META-INF/container.xml')
    if (!containerFile) return undefined
    const containerXml = await containerFile.async('text')
    const opfMatch = containerXml.match(/full-path="([^"]+)"/)
    if (!opfMatch) return undefined

    const opfPath = opfMatch[1]
    const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : ''
    const opfFile = zip.file(opfPath)
    if (!opfFile) return undefined
    const opfXml = await opfFile.async('text')

    const { cov } = parseOpf(opfXml, '')
    if (!cov?.href) return undefined

    // Resolve and extract cover image
    const coverPath = opfDir + cov.href
    const coverFile = zip.file(coverPath)
    if (!coverFile) return undefined
    const ext = coverPath.split('.').pop()?.toLowerCase() || 'jpg'
    const mime = ext === 'jpg' ? 'jpeg' : ext === 'svg' ? 'svg+xml' : ext
    const b64 = await coverFile.async('base64')
    return `data:image/${mime};base64,${b64}`
  } catch { return undefined }
}

export async function parseEpub(base64Data: string): Promise<EpubContent> {
  const binaryStr = atob(base64Data)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)

  const zip = await JSZip.loadAsync(bytes)

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

  const containerFile = zip.file('META-INF/container.xml')
  if (!containerFile) throw new Error('Not a valid EPUB: missing container.xml')

  const containerXml = await containerFile.async('text')
  const opfPath = parseContainerXml(containerXml)
  if (!opfPath) throw new Error('Cannot find OPF path in container.xml')

  const opfFile = zip.file(opfPath)
  if (!opfFile) throw new Error(`OPF file not found: ${opfPath}`)

  const opfXml = await opfFile.async('text')
  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : ''

  const { metadata, manifest, spine, cov } = parseOpf(opfXml, opfDir)

  const resolvedSpine = spine.map((s) => ({
    id: s.id,
    href: manifest.find((m) => m.id === s.id)?.href || ''
  }))

  const files = new Map<string, string>()
  for (const item of resolvedSpine) {
    const htmlFile = zip.file(item.href)
    if (!htmlFile) continue
    try {
      let html = await htmlFile.async('text')
      const chapterDir = item.href.includes('/')
        ? item.href.substring(0, item.href.lastIndexOf('/') + 1)
        : ''

      const resolveUrl = (attrValue: string): string | null => {
        const cleanPath = attrValue.split('#')[0].split('?')[0]
        if (!cleanPath) return null
        if (imageDataUrls.has(cleanPath)) return imageDataUrls.get(cleanPath)!
        if (chapterDir) {
          const resolved = chapterDir + cleanPath.replace(/^\.\//, '')
          if (imageDataUrls.has(resolved)) return imageDataUrls.get(resolved)!
          const normalized = resolveRelative(chapterDir, cleanPath)
          if (imageDataUrls.has(normalized)) return imageDataUrls.get(normalized)!
        }
        const targetFile = cleanPath.split('/').pop() || cleanPath
        for (const [imgPath, dataUrl] of imageDataUrls) {
          const imgFile = imgPath.split('/').pop() || imgPath
          if (imgFile === targetFile) return dataUrl
        }
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
      // skip
    }
  }

  // Build TOC
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

  if (toc.length === 0) {
    toc = resolvedSpine.map((s, i) => ({
      label: `Chapter ${i + 1}`,
      href: s.href,
      spineIndex: i
    }))
  }

  // Assign spineIndex to all TOC items (including nested subitems)
  let globalIdx = 0
  function assignSpineIndex(items: TocItem[]) {
    for (const item of items) {
      if (item.spineIndex < 0) {
        const tocHref = item.href.replace(/#.*$/, '')
        let matchedIndex = resolvedSpine.findIndex(
          (s) => s.href === tocHref || s.href === item.href
        )
        if (matchedIndex < 0) {
          const tocFile = tocHref.split('/').pop() || ''
          matchedIndex = resolvedSpine.findIndex(
            (s) => (s.href.split('/').pop() || '') === tocFile
          )
        }
        // Fallback: use global TOC position (each item gets a unique index)
        if (matchedIndex < 0) {
          matchedIndex = Math.min(globalIdx, resolvedSpine.length - 1)
        }
        item.spineIndex = matchedIndex >= 0 ? matchedIndex : 0
      }
      globalIdx++
      if (item.subitems) assignSpineIndex(item.subitems)
    }
  }
  assignSpineIndex(toc)

  // Extract cover image
  let coverUrl: string | undefined
  if (cov?.href) {
    const key = resolveRelative(opfDir, cov.href)
    if (imageDataUrls.has(key)) coverUrl = imageDataUrls.get(key)
  }

  return {
    metadata: {
      title: metadata.title || 'Untitled',
      author: metadata.creator || 'Unknown Author'
    },
    toc,
    spine: resolvedSpine,
    files,
    coverUrl
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
  cov: { href: string } | null
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

  // Detect cover image
  let cov: { href: string } | null = null
  // EPUB 2: <meta name="cover" content="cover-id"/>
  const coverMeta = xml.match(/<meta\s+[^>]*name="cover"[^>]*content="([^"]+)"[^>]*\/?>/)
  if (coverMeta) {
    const coverItem = manifest.find((x) => x.id === coverMeta[1])
    if (coverItem) cov = { href: coverItem.href }
  }
  // EPUB 3: <item properties="cover-image"/>
  if (!cov) {
    const cov3Match = xml.match(/<item\s+[^>]*properties="cover-image"[^>]*href="([^"]+)"[^>]*\/?>/)
    if (cov3Match) cov = { href: cov3Match[1] }
  }
  // Fallback: first image manifest item
  if (!cov) {
    const imgItem = manifest.find((x) => /image\//i.test(x.mediaType))
    if (imgItem) cov = { href: imgItem.href }
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

  return { metadata, manifest, spine, cov }
}

function resolveRelative(baseDir: string, rel: string): string {
  const dir = baseDir.replace(/\/$/, '')
  const parts = dir ? dir.split('/') : []
  for (const seg of rel.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.') parts.push(seg)
  }
  return parts.join('/')
}

/** Parse NCX with full XML DOM parser (handles nested navPoint hierarchy) */
function parseNcx(xml: string, baseDir: string): TocItem[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')
  const navMap = doc.querySelector('navMap')
  if (!navMap) return []

  function parseNavPoints(parent: Element): TocItem[] {
    const items: TocItem[] = []
    const navPoints = parent.querySelectorAll(':scope > navPoint')
    navPoints.forEach((np) => {
      const labelEl = np.querySelector(':scope > navLabel > text')
      const contentEl = np.querySelector(':scope > content')
      const label = labelEl?.textContent?.trim() || ''
      const src = contentEl?.getAttribute('src') || ''
      if (label && src) {
        const resolvedHref = resolveRelative(baseDir, src)
        const subitems = parseNavPoints(np)
        items.push({
          label,
          href: resolvedHref,
          spineIndex: -1,
          subitems: subitems.length > 0 ? subitems : undefined
        })
      }
    })
    return items
  }

  return parseNavPoints(navMap)
}
