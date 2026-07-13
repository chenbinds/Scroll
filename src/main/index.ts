import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { readFileSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import {
  registerCoverSchemePrivileged,
  registerCoverProtocol,
  saveCoverFromDataUrl,
  migrateInlineCovers,
  coverUrlFor
} from './covers'
import { bookStore, settingsStore, musicStore } from './storage'

const bootStarted = Date.now()

// Custom protocol must be registered before ready
registerCoverSchemePrivileged()

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  console.log(`[scroll] createWindow +${Date.now() - bootStarted}ms`)
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    // Show immediately with HTML splash — don't wait for React
    show: true,
    title: '卷轴 Scroll',
    autoHideMenuBar: true,
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: true,
      backgroundThrottling: false
    }
  })

  mainWindow.webContents.on('did-finish-load', () => {
    console.log(`[scroll] did-finish-load +${Date.now() - bootStarted}ms`)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ============================================================
// IPC Handlers
// ============================================================

// Theme: update native window background for ClearType sub-pixel AA
ipcMain.handle('window:setBackgroundColor', (_event, color: string) => {
  if (mainWindow) {
    mainWindow.setBackgroundColor(color)
  }
})

// Open book dialog
ipcMain.handle('dialog:openBook', async () => {
  const result = await dialog.showOpenDialog({
    title: '打开电子书',
    filters: [
      { name: '支持的所有格式', extensions: ['pdf', 'epub', 'mobi', 'azw3', 'txt', 'md', 'cbz', 'cbr', 'djvu', 'azw', 'fb2'] },
      { name: 'PDF', extensions: ['pdf'] },
      { name: 'EPUB', extensions: ['epub'] },
      { name: 'Kindle', extensions: ['mobi', 'azw3', 'azw'] },
      { name: '文本文档', extensions: ['txt', 'md', 'markdown'] },
      { name: '漫画', extensions: ['cbz', 'cbr'] }
    ],
    properties: ['openFile', 'multiSelections']
  })
  return result.canceled ? null : result.filePaths
})

// 读取文件内容（用于 PDF/EPUB 等需要在渲染进程处理的格式）
ipcMain.handle('file:read', async (_event, filePath: string) => {
  try {
    const buffer = readFileSync(filePath)
    return buffer.toString('base64')
  } catch (error) {
    console.error('File read error:', error)
    throw error
  }
})

// 打开音乐文件对话框
ipcMain.handle('dialog:openMusic', async () => {
  const result = await dialog.showOpenDialog({
    title: '打开音乐文件',
    filters: [
      { name: '音频文件', extensions: ['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a', 'wma', 'opus'] },
      { name: 'MP3', extensions: ['mp3'] },
      { name: '无损音频', extensions: ['flac', 'wav'] }
    ],
    properties: ['openFile', 'multiSelections']
  })
  return result.canceled ? null : result.filePaths
})

// 获取应用数据目录
ipcMain.handle('app:getDataPath', () => {
  return app.getPath('userData')
})

// AI 请求代理（主进程发 HTTP，避免渲染进程 CORS 问题）
ipcMain.handle('ai:chat', async (_event, { baseUrl, apiKey, model, messages, maxTokens }) => {
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens || 4096,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`AI API 错误 ${response.status}: ${errorBody}`)
    }

    return await response.json()
  } catch (error) {
    console.error('AI 请求失败:', error)
    throw error
  }
})

// Read file by local path (for cover extraction etc.)
ipcMain.handle('file:readPath', async (_event, filePath: string) => {
  try {
    const buf = readFileSync(filePath)
    return buf.toString('base64')
  } catch { return null }
})

// Save cover thumbnail to disk; returns scroll-cover:// URL (keeps books JSON tiny)
ipcMain.handle('covers:save', async (_event, bookId: string, dataUrl: string) => {
  if (!bookId || !dataUrl) return null
  return saveCoverFromDataUrl(bookId, dataUrl)
})

ipcMain.handle('covers:url', (_event, bookId: string) => coverUrlFor(bookId))

// Douban search proxy — uses Node.js https (reliable, bypasses Electron net.fetch issues)
ipcMain.handle('douban:search', async (_event, title: string, author?: string) => {
  try {
    const query = encodeURIComponent(author ? `${title} ${author}` : title)
    const html = await new Promise<string>((resolve, reject) => {
      const httpMod = require('https') as typeof import('https')
      const req = httpMod.get(
        `https://book.douban.com/subject_search?search_text=${query}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'zh-CN,zh;q=0.9',
          },
        },
        (res) => {
          if (res.statusCode !== 200) { let d = ''; res.on('data', (c: string) => d += c); res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${d.slice(0, 200)}`))); return }
          let data = ''
          res.on('data', (chunk: string) => data += chunk)
          res.on('end', () => resolve(data))
        }
      )
      req.on('error', reject)
      req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')) })
    })
    // Find rating blocks and extract nearby title + url
    const ratingRe = /"rating":\s*\{"count":\s*\d+,\s*"rating_info":\s*"[^"]*",\s*"star_count":\s*[\d.]+,\s*"value":\s*([\d.]+)\}/g
    let rm: RegExpExecArray | null
    while ((rm = ratingRe.exec(html)) !== null) {
      const value = parseFloat(rm[1])
      if (isNaN(value) || value <= 0) continue
      // Look for title and url near this rating (within 300 chars)
      const ctx = html.slice(Math.max(0, rm.index - 300), rm.index + 500)
      const tMatch = ctx.match(/"title":\s*"([^"]+)"/)
      const uMatch = ctx.match(/"url":\s*"(https:\/\/book\.douban\.com\/subject\/\d+\/)"/)
      if (tMatch && uMatch) {
        const bookTitle = tMatch[1].replace(/\\u([0-9a-fA-F]{4})/g, (_s: string, h: string) => String.fromCharCode(parseInt(h, 16)))
        return { rating: value, url: uMatch[1], title: bookTitle }
      }
    }
    return null
  } catch { return null }
})

// One-shot bootstrap — avoids N sequential storage IPC round-trips on startup
ipcMain.handle('app:bootstrap', async () => {
  const t0 = Date.now()
  let books = bookStore.get('books', []) as unknown
  if (Array.isArray(books)) {
    const migrated = migrateInlineCovers(books as { id: string; coverUrl?: string }[])
    if (migrated.changed) {
      bookStore.set('books', migrated.books)
      books = migrated.books
    }
  }
  const payload = {
    books: Array.isArray(books) ? books : [],
    bookmarks: settingsStore.get('bookmarks', []),
    darkMode: settingsStore.get('darkMode', true),
    readingTheme: settingsStore.get('readingTheme', 'light'),
    readingFont: settingsStore.get('readingFont', 'system'),
    aiConfig: settingsStore.get('aiConfig', null)
  }
  console.log(`[scroll] bootstrap +${Date.now() - bootStarted}ms (handler ${Date.now() - t0}ms)`)
  return payload
})

// 存储：读取（书架启动时顺便把内嵌封面迁到磁盘，避免 IPC 传几百 KB）
ipcMain.handle('storage:get', async (_event, key: string, defaultValue: unknown) => {
  if (key.startsWith('books') || key.startsWith('book_')) {
    const value = bookStore.get(key, defaultValue)
    if (key === 'books' && Array.isArray(value)) {
      const { books, changed } = migrateInlineCovers(value as { id: string; coverUrl?: string }[])
      if (changed) bookStore.set(key, books)
      return books
    }
    return value
  } else if (key.startsWith('settings') || key.startsWith('ai_')) {
    return settingsStore.get(key, defaultValue)
  } else if (key.startsWith('music')) {
    return musicStore.get(key, defaultValue)
  }
  return settingsStore.get(key, defaultValue)
})

// 存储：写入
ipcMain.handle('storage:set', async (_event, key: string, value: unknown) => {
  if (key.startsWith('books') || key.startsWith('book_')) {
    bookStore.set(key, value)
  } else if (key.startsWith('settings') || key.startsWith('ai_')) {
    settingsStore.set(key, value)
  } else if (key.startsWith('music')) {
    musicStore.set(key, value)
  } else {
    settingsStore.set(key, value)
  }
  return true
})

// 应用就绪
app.whenReady().then(() => {
  console.log(`[scroll] whenReady +${Date.now() - bootStarted}ms`)
  electronApp.setAppUserModelId('com.scroll.ebook-reader')
  registerCoverProtocol()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// 所有窗口关闭时退出（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
