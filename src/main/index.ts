import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: 'Scroll',
    autoHideMenuBar: true,
    backgroundColor: '#ffffff', // MUST be opaque — enables ClearType sub-pixel AA on Windows
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  // 在外部浏览器打开链接
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 开发：加载 vite dev server；生产：加载打包后的文件
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
import { readFileSync } from 'fs'
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

import { execFile } from 'child_process'
import { existsSync } from 'fs'

// MOBI/AZW3 → EPUB conversion via Calibre's ebook-convert
ipcMain.handle('mobi:convert', async (_event, filePath: string) => {
  // Priority: 1) bundled portable, 2) system install, 3) PATH
  const candidates = [
    join(__dirname, '../../tools/calibre-portable/Calibre/ebook-convert.exe'),
    'C:/Program Files/Calibre2/ebook-convert.exe',
    'C:/Program Files (x86)/Calibre2/ebook-convert.exe',
    'ebook-convert',
  ]
  let converter = ''
  for (const c of candidates) {
    if (existsSync(c)) { converter = c; break }
  }
  if (!converter) return null

  return new Promise((resolve) => {
    const epubPath = filePath.replace(/\.\w+$/, '_conv.epub')
    if (existsSync(epubPath)) { resolve(epubPath); return }
    execFile(converter, [filePath, epubPath], { timeout: 120000 }, (err) => {
      if (err || !existsSync(epubPath)) { resolve(null); return }
      resolve(epubPath)
    })
  })
})

// 存储：读取
ipcMain.handle('storage:get', async (_event, key: string, defaultValue: unknown) => {
  const { bookStore, settingsStore, musicStore } = await import('./storage')
  // 根据 key 前缀选择对应的 store
  if (key.startsWith('books') || key.startsWith('book_')) {
    return bookStore.get(key, defaultValue)
  } else if (key.startsWith('settings') || key.startsWith('ai_')) {
    return settingsStore.get(key, defaultValue)
  } else if (key.startsWith('music')) {
    return musicStore.get(key, defaultValue)
  }
  return settingsStore.get(key, defaultValue)
})

// 存储：写入
ipcMain.handle('storage:set', async (_event, key: string, value: unknown) => {
  const { bookStore, settingsStore, musicStore } = await import('./storage')
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
  electronApp.setAppUserModelId('com.scroll.ebook-reader')

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
