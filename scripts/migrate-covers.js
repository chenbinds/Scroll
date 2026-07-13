const { app, nativeImage } = require('electron')
const fs = require('fs')
const path = require('path')

app.whenReady().then(() => {
  const booksPath = path.join(app.getPath('userData'), 'data', 'books_books.json')
  const coversDir = path.join(app.getPath('userData'), 'covers')
  if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true })
  const books = JSON.parse(fs.readFileSync(booksPath, 'utf8'))
  let changed = 0
  for (const b of books) {
    if (!b.coverUrl || !b.coverUrl.startsWith('data:')) continue
    const m = b.coverUrl.match(/^data:([^;,]+);base64,(.+)$/i)
    if (!m) continue
    const raw = Buffer.from(m[2], 'base64')
    let img = nativeImage.createFromBuffer(raw)
    const out = path.join(coversDir, b.id + '.jpg')
    if (!img.isEmpty()) {
      const { width, height } = img.getSize()
      const max = 320
      if (width > max || height > max) {
        const scale = max / Math.max(width, height)
        img = img.resize({ width: Math.round(width * scale), height: Math.round(height * scale), quality: 'better' })
      }
      fs.writeFileSync(out, img.toJPEG(72))
    } else {
      fs.writeFileSync(out, raw)
    }
    b.coverUrl = 'scroll-cover://local/' + b.id
    changed++
  }
  fs.writeFileSync(booksPath, JSON.stringify(books))
  console.log('migrated', changed, 'jsonKB', (fs.statSync(booksPath).size/1024).toFixed(1))
  app.quit()
})
