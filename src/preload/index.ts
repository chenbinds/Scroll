import { contextBridge, ipcRenderer } from 'electron'

// 暴露给渲染进程的安全 API
contextBridge.exposeInMainWorld('scrollAPI', {
  // 文件操作
  openBookDialog: () => ipcRenderer.invoke('dialog:openBook'),
  openMusicDialog: () => ipcRenderer.invoke('dialog:openMusic'),
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),

  // 窗口控制
  getDataPath: () => ipcRenderer.invoke('app:getDataPath'),
  setBackgroundColor: (color: string) => ipcRenderer.invoke('window:setBackgroundColor', color),

  // AI 聊天 (OpenAI 兼容协议)
  aiChat: (params: AiChatParams) => ipcRenderer.invoke('ai:chat', params),

  // 数据库操作（后续扩展）
  db: {
    // 占位 — 后续通过 IPC 调用 better-sqlite3
  },

  // 存储（JSON 文件持久化）
  storage: {
    get: (key: string, defaultValue: unknown) => ipcRenderer.invoke('storage:get', key, defaultValue),
    set: (key: string, value: unknown) => ipcRenderer.invoke('storage:set', key, value)
  }
})

// 类型定义
export interface AiChatParams {
  baseUrl: string
  apiKey: string
  model: string
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
  maxTokens?: number
}

export interface ScrollAPI {
  openBookDialog: () => Promise<string[] | null>
  openMusicDialog: () => Promise<string[] | null>
  readFile: (filePath: string) => Promise<string>
  getDataPath: () => Promise<string>
  setBackgroundColor: (color: string) => Promise<void>
  aiChat: (params: AiChatParams) => Promise<any>
  db: Record<string, never>
  storage: {
    get: (key: string, defaultValue: unknown) => Promise<unknown>
    set: (key: string, value: unknown) => Promise<boolean>
  }
}
