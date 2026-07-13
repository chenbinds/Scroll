import { contextBridge, ipcRenderer } from 'electron'

/** Fire bootstrap as soon as preload runs — overlaps with renderer bundle parse */
const bootstrapPromise = ipcRenderer.invoke('app:bootstrap')

function listenStreamChunk(
  requestId: string,
  onChunk: (chunk: string) => void
): () => void {
  const handler = (_e: Electron.IpcRendererEvent, data: { requestId: string; chunk: string }) => {
    if (data.requestId === requestId) onChunk(data.chunk)
  }
  ipcRenderer.on('ai:stream-chunk', handler)
  return () => ipcRenderer.removeListener('ai:stream-chunk', handler)
}

contextBridge.exposeInMainWorld('scrollAPI', {
  openBookDialog: () => ipcRenderer.invoke('dialog:openBook'),
  openMusicDialog: () => ipcRenderer.invoke('dialog:openMusic'),
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  readPath: (filePath: string) => ipcRenderer.invoke('file:readPath', filePath),

  getDataPath: () => ipcRenderer.invoke('app:getDataPath'),
  setBackgroundColor: (color: string) => ipcRenderer.invoke('window:setBackgroundColor', color),
  confirmClose: () => ipcRenderer.invoke('window:confirm-close'),
  cancelClose: () => ipcRenderer.invoke('window:cancel-close'),
  onCloseRequested: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('app:close-requested', handler)
    return () => ipcRenderer.removeListener('app:close-requested', handler)
  },

  bootstrap: () => bootstrapPromise,

  aiChat: (params: AiChatParams) => ipcRenderer.invoke('ai:chat', params),

  aiChatStream: (params: AiChatStreamParams, onChunk: (chunk: string) => void) => {
    const requestId = crypto.randomUUID()
    const unlisten = listenStreamChunk(requestId, onChunk)
    return ipcRenderer
      .invoke('ai:chatStream', { ...params, requestId })
      .finally(unlisten) as Promise<{ content: string }>
  },

  aiTestConnection: (params: AiTestParams) => ipcRenderer.invoke('ai:test', params),

  db: {},

  doubanSearch: (title: string, author?: string) => ipcRenderer.invoke('douban:search', title, author),

  /** Persist cover thumbnail to disk; returns scroll-cover:// URL */
  saveCover: (bookId: string, dataUrl: string) =>
    ipcRenderer.invoke('covers:save', bookId, dataUrl) as Promise<string | null>,

  storage: {
    get: (key: string, defaultValue: unknown) => ipcRenderer.invoke('storage:get', key, defaultValue),
    set: (key: string, value: unknown) => ipcRenderer.invoke('storage:set', key, value)
  }
})

export interface AiChatParams {
  baseUrl: string
  apiKey: string
  model: string
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
  maxTokens?: number
}

export interface AiChatStreamParams extends AiChatParams {}

export interface AiTestParams {
  baseUrl: string
  apiKey: string
  model: string
}

type DoubanSearchResult =
  | { ok: true; rating: number; url: string; title: string }
  | { ok: false; error: 'network' | 'timeout' | 'blocked' | 'not_found' | 'http' }

export interface ScrollAPI {
  doubanSearch: (title: string, author?: string) => Promise<DoubanSearchResult>
  openBookDialog: () => Promise<string[] | null>
  openMusicDialog: () => Promise<string[] | null>
  readFile: (filePath: string) => Promise<string>
  readPath: (filePath: string) => Promise<string | null>
  getDataPath: () => Promise<string>
  setBackgroundColor: (color: string) => Promise<void>
  confirmClose: () => Promise<boolean>
  cancelClose: () => Promise<boolean>
  onCloseRequested: (cb: () => void) => () => void
  bootstrap: () => Promise<{
    books: unknown[]
    bookmarksByBook: unknown
    darkMode: unknown
    readingTheme: unknown
    readingFont: unknown
    readerFontSize: unknown
    aiConfig: unknown
  }>
  aiChat: (params: AiChatParams) => Promise<any>
  aiChatStream: (params: AiChatStreamParams, onChunk: (chunk: string) => void) => Promise<{ content: string }>
  aiTestConnection: (params: AiTestParams) => Promise<{ ok: true }>
  saveCover: (bookId: string, dataUrl: string) => Promise<string | null>
  db: Record<string, never>
  storage: {
    get: (key: string, defaultValue: unknown) => Promise<unknown>
    set: (key: string, value: unknown) => Promise<boolean>
  }
}
