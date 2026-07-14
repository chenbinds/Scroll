import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import {
  registerCoverSchemePrivileged,
  registerCoverProtocol,
  saveCoverFromDataUrl,
  migrateInlineCovers,
  coverUrlFor
} from './covers'
import { searchDoubanBook } from './douban'
import { bookStore, settingsStore, musicStore } from './storage'

const bootStarted = Date.now()

// Custom protocol must be registered before ready
registerCoverSchemePrivileged()

let mainWindow: BrowserWindow | null = null
/** When true, the next close event proceeds without prompting */
let allowClose = false
/** True while waiting for renderer leave dialog — ignore repeat X clicks */
let awaitingLeaveDecision = false

function createWindow(): void {
  console.log(`[scroll] createWindow +${Date.now() - bootStarted}ms`)
  allowClose = false
  awaitingLeaveDecision = false
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
      backgroundThrottling: false,
      v8CacheOptions: 'bypassHeatCheck'
    }
  })

  // Unified leave: renderer shows React UnsavedAnnotationsDialog
  mainWindow.on('close', (e) => {
    if (allowClose) return
    e.preventDefault()
    if (awaitingLeaveDecision) return
    awaitingLeaveDecision = true
    mainWindow?.webContents.send('app:close-requested')
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

// Renderer confirmed leave — actually close the window
ipcMain.handle('window:confirm-close', () => {
  allowClose = true
  awaitingLeaveDecision = false
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close()
  }
  return true
})

// Renderer cancelled leave dialog — allow another X click
ipcMain.handle('window:cancel-close', () => {
  awaitingLeaveDecision = false
  return true
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

/** Save UTF-8 text (annotation Markdown / JSON export). */
ipcMain.handle(
  'dialog:saveTextFile',
  async (
    _event,
    opts: {
      defaultName?: string
      content: string
      title?: string
      filters?: { name: string; extensions: string[] }[]
    }
  ) => {
    if (typeof opts?.content !== 'string') return { ok: false as const, error: 'invalid' }
    const result = await dialog.showSaveDialog({
      title: opts.title || '导出',
      defaultPath: opts.defaultName || 'export.md',
      filters: opts.filters ?? [
        { name: 'Markdown', extensions: ['md'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    if (result.canceled || !result.filePath) return { ok: false as const, canceled: true as const }
    try {
      writeFileSync(result.filePath, opts.content, 'utf-8')
      return { ok: true as const, path: result.filePath }
    } catch (e) {
      console.error('saveTextFile error', e)
      return { ok: false as const, error: 'write_failed' }
    }
  }
)

/** Open a UTF-8 text file (annotation import). */
ipcMain.handle(
  'dialog:openTextFile',
  async (
    _event,
    opts?: {
      title?: string
      filters?: { name: string; extensions: string[] }[]
    }
  ) => {
    const result = await dialog.showOpenDialog({
      title: opts?.title || '导入',
      filters: opts?.filters ?? [
        { name: '标注导出', extensions: ['md', 'json'] },
        { name: 'Markdown', extensions: ['md'] },
        { name: 'JSON', extensions: ['json'] }
      ],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths[0]) return null
    try {
      const content = readFileSync(result.filePaths[0], 'utf-8')
      return { path: result.filePaths[0], content }
    } catch (e) {
      console.error('openTextFile error', e)
      return null
    }
  }
)

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

ipcMain.handle('fs:pathExists', async (_event, filePath: string) => {
  if (typeof filePath !== 'string' || !filePath.trim()) return false
  return existsSync(filePath)
})

ipcMain.handle('shell:openExternal', async (_event, url: string) => {
  if (typeof url !== 'string' || !url.trim()) return false
  const normalized = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
  await shell.openExternal(normalized)
  return true
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

// AI 流式请求 — SSE chunks via webContents.send
ipcMain.handle(
  'ai:chatStream',
  async (event, { baseUrl, apiKey, model, messages, maxTokens, requestId }) => {
    const wc = event.sender
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
        temperature: 0.7,
        stream: true
      })
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`AI API 错误 ${response.status}: ${errorBody}`)
    }

    if (!response.body) throw new Error('AI API 未返回流式响应')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') continue
        try {
          const json = JSON.parse(data) as {
            choices?: { delta?: { content?: string } }[]
          }
          const delta = json.choices?.[0]?.delta?.content
          if (delta) {
            fullText += delta
            wc.send('ai:stream-chunk', { requestId, chunk: delta })
          }
        } catch {
          // ignore malformed SSE line
        }
      }
    }

    return { content: fullText }
  }
)

ipcMain.handle('ai:test', async (_event, { baseUrl, apiKey, model }) => {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 8
    })
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`HTTP ${response.status}: ${body.slice(0, 300)}`)
  }
  return { ok: true }
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

// Douban search proxy — Node.js https; returns structured errors for UI feedback
ipcMain.handle('douban:search', async (_event, title: string, author?: string) => {
  return searchDoubanBook(title, author)
})

// One-shot bootstrap — avoids N sequential storage IPC round-trips on startup
ipcMain.handle('app:bootstrap', async () => {
  const t0 = Date.now()
  const books = bookStore.get('books', []) as unknown
  const booksArr = Array.isArray(books) ? books : []

  // Defer inline-cover migration — don't block first paint
  const hasInlineCovers = booksArr.some(
    (b) => typeof b === 'object' && b && 'coverUrl' in b && typeof (b as { coverUrl?: string }).coverUrl === 'string'
      && (b as { coverUrl: string }).coverUrl.startsWith('data:')
  )
  if (hasInlineCovers) {
    setImmediate(() => {
      const migrated = migrateInlineCovers(booksArr as { id: string; coverUrl?: string }[])
      if (migrated.changed) bookStore.set('books', migrated.books)
    })
  }

  const payload = {
    books: booksArr,
    bookmarksByBook: settingsStore.get('bookmarksByBook', {}),
    darkMode: settingsStore.get('darkMode', true),
    readingTheme: settingsStore.get('readingTheme', 'light'),
    readingFont: settingsStore.get('readingFont', 'system'),
    readerFontSize: settingsStore.get('readerFontSize', 100),
    readingLineHeight: settingsStore.get('readingLineHeight', 1.85),
    readingParagraphGap: settingsStore.get('readingParagraphGap', 1.25),
    readingPageMargin: settingsStore.get('readingPageMargin', 2),
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
