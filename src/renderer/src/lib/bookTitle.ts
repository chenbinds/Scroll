/**
 * Clean display titles from filenames / polluted ebook metadata
 * (e.g. Z-Library style: 书名（长宣传语）(作者) (z-library.sk, ...)).
 */
export function cleanBookTitle(raw: string): string {
  let t = (raw || '').trim()
  if (!t) return t

  t = t.replace(/\.(mobi|azw3?|azw|epub|pdf|txt|md|cbz|cbr)$/i, '')

  // Pirate / mirror site suffixes
  t = t.replace(
    /\s*[\(（][^)）]*(?:z-?library|z-?lib\.|1lib|libgen|annas-?archive|zlib)[^)）]*[\)）]\s*$/i,
    ''
  ).trim()

  // Trailing author tags like ([美]盖伊·特立斯)
  t = t.replace(/\s*[\(（]\[[^\]]*\][^)）]*[\)）]\s*$/u, '').trim()

  // Long fullwidth marketing blurb: 书名（……宣传语……）
  const fw = t.indexOf('（')
  if (fw > 0 && t.length - fw > 12) {
    t = t.slice(0, fw).trim()
  }

  // Long ASCII parenthetical leftover
  const hw = t.indexOf('(')
  if (hw > 0 && t.length - hw > 20) {
    t = t.slice(0, hw).trim()
  }

  return t || raw.trim()
}
