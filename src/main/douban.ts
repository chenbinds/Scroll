import https from 'https'

export type DoubanSearchResult =
  | { ok: true; rating: number; url: string; title: string }
  | { ok: false; error: 'network' | 'timeout' | 'blocked' | 'not_found' | 'http' }

function fetchSearchHtml(query: string): Promise<{ status: number; html: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      `https://book.douban.com/subject_search?search_text=${query}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'zh-CN,zh;q=0.9',
          Referer: 'https://book.douban.com/'
        }
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          req.destroy()
          reject(Object.assign(new Error(`redirect ${res.statusCode}`), { code: 'REDIRECT' }))
          return
        }
        let data = ''
        res.on('data', (chunk: string) => {
          data += chunk
        })
        res.on('end', () => resolve({ status: res.statusCode ?? 0, html: data }))
      }
    )
    req.on('error', reject)
    req.setTimeout(15000, () => {
      req.destroy()
      reject(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }))
    })
  })
}

function parseRatingFromHtml(html: string): { rating: number; url: string; title: string } | null {
  const ratingRe =
    /"rating":\s*\{"count":\s*\d+,\s*"rating_info":\s*"[^"]*",\s*"star_count":\s*[\d.]+,\s*"value":\s*([\d.]+)\}/g
  let rm: RegExpExecArray | null
  while ((rm = ratingRe.exec(html)) !== null) {
    const value = parseFloat(rm[1])
    if (isNaN(value) || value <= 0) continue
    const ctx = html.slice(Math.max(0, rm.index - 300), rm.index + 500)
    const tMatch = ctx.match(/"title":\s*"([^"]+)"/)
    const uMatch = ctx.match(/"url":\s*"(https:\/\/book\.douban\.com\/subject\/\d+\/)"/)
    if (tMatch && uMatch) {
      const bookTitle = tMatch[1].replace(/\\u([0-9a-fA-F]{4})/g, (_s: string, h: string) =>
        String.fromCharCode(parseInt(h, 16))
      )
      return { rating: value, url: uMatch[1], title: bookTitle }
    }
  }
  return null
}

export async function searchDoubanBook(title: string, author?: string): Promise<DoubanSearchResult> {
  try {
    const query = encodeURIComponent(author ? `${title} ${author}` : title)
    const { status, html } = await fetchSearchHtml(query)

    if (status === 403 || status === 451) {
      return { ok: false, error: 'blocked' }
    }
    if (status !== 200) {
      console.warn('[scroll] douban HTTP', status)
      return { ok: false, error: 'http' }
    }

    if (/sec\.douban\.com|captcha|人机验证|禁止访问/i.test(html)) {
      return { ok: false, error: 'blocked' }
    }

    const parsed = parseRatingFromHtml(html)
    if (!parsed) {
      return { ok: false, error: 'not_found' }
    }
    return { ok: true, ...parsed }
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code
    if (code === 'ETIMEDOUT' || (err as Error)?.message === 'timeout') {
      return { ok: false, error: 'timeout' }
    }
    if (code === 'ECONNRESET' || code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
      console.warn('[scroll] douban network error:', code)
      return { ok: false, error: 'network' }
    }
    console.warn('[scroll] douban error:', err)
    return { ok: false, error: 'network' }
  }
}
