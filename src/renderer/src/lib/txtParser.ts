/**
 * TXT chapter parser
 * Detects chapters by common patterns in Chinese/English ebooks.
 */

export interface TxtChapter {
  title: string
  content: string
}

const CHAPTER_PATTERNS = [
  /^第[零一二三四五六七八九十百千万\d]+[章节回卷部集篇]\s*[^\n]*/,
  /^Chapter\s+\d+/i,
  /^CH\s*\d+/,
  /^Part\s+\d+/i,
  /^Section\s+\d+/i,
  /^[ⅰⅱⅲⅳⅴⅵⅶⅷⅸⅹⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]\s*[\.、．]?\s*/,
  /^[0-9]+\s*[\.、．]\s*/,
  /^序[章言]/,
  /^楔子/,
  /^引[子言]/,
  /^前言/,
  /^后记/,
  /^尾声/,
  /^番外/,
]

export function parseTxt(text: string): TxtChapter[] {
  // Normalize line endings
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')

  const chapters: TxtChapter[] = []
  let currentTitle = ''
  let currentContent: string[] = []
  let preamble: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (currentTitle) currentContent.push('')
      else preamble.push('')
      continue
    }

    const isChapter = CHAPTER_PATTERNS.some((p) => p.test(trimmed))

    if (isChapter) {
      // Save previous chapter
      if (currentTitle || currentContent.length > 0) {
        chapters.push({
          title: currentTitle || '(Start)',
          content: currentContent.join('\n').trim()
        })
      }
      currentTitle = trimmed
      currentContent = []
    } else {
      if (currentTitle) {
        currentContent.push(trimmed)
      } else {
        preamble.push(trimmed)
      }
    }
  }

  // Save last chapter
  if (currentTitle || currentContent.length > 0) {
    chapters.push({
      title: currentTitle || '(Start)',
      content: currentContent.join('\n').trim()
    })
  }

  // If no chapters detected, treat entire file as one chapter
  if (chapters.length === 0) {
    const allLines = preamble.length > 0 ? preamble : lines.filter((l) => l.trim())
    chapters.push({
      title: '(Full Text)',
      content: allLines.join('\n').trim()
    })
  }

  return chapters
}
