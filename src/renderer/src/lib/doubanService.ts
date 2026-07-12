/**
 * Fetch Douban book rating via renderer process (has browser cookies).
 * Uses a lightweight proxy approach since Douban blocks non-browser requests.
 */

interface DoubanResult { rating: number; url: string; title: string }

export async function searchDouban(title: string): Promise<DoubanResult | null> {
  try {
    // Try direct fetch first (Electron renderer has browser cookies)
    const query = encodeURIComponent(title.slice(0, 80))
    const url = `https://book.douban.com/subject_search?search_text=${query}`

    // Use XMLHttpRequest which works better with cookies in Electron
    const html = await xhrFetch(url)
    if (!html || html.length < 1000) return null

    // Parse embedded rating JSON
    const re = /"rating":\s*\{"count":\s*\d+,\s*"rating_info":\s*"[^"]*",\s*"star_count":\s*[\d.]+,\s*"value":\s*([\d.]+)\}/g
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
      const value = parseFloat(m[1])
      if (isNaN(value) || value <= 0) continue
      const ctx = html.slice(Math.max(0, m.index - 300), m.index + 500)
      const tM = ctx.match(/"title":\s*"([^"]+)"/)
      const uM = ctx.match(/"url":\s*"(https:\/\/book\.douban\.com\/subject\/\d+\/)"/)
      if (tM && uM) {
        const bookTitle = tM[1].replace(/\\u([0-9a-fA-F]{4})/g, (_s: string, h: string) => String.fromCharCode(parseInt(h, 16)))
        return { rating: value, url: uM[1], title: bookTitle }
      }
    }
    return null
  } catch {
    return null
  }
}

function xhrFetch(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', url, true)
    xhr.timeout = 10000
    xhr.onload = () => resolve(xhr.responseText)
    xhr.onerror = () => reject(new Error('XHR failed'))
    xhr.ontimeout = () => reject(new Error('XHR timeout'))
    xhr.send()
  })
}
