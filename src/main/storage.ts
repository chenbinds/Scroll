/**
 * 轻量 JSON 文件存储
 *
 * 替代 better-sqlite3，零编译依赖。
 * 数据存储在应用 userData 目录下的 JSON 文件中。
 * 项目内运行：`<项目根>/UserData/`（开发 out/ 与 win-unpacked 共用）
 * 真正便携包：exe 旁 `UserData/`（见 portableData.ts）
 * 适用于 MVP 阶段的数据持久化需求。
 */

import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

class JsonStore {
  private basePath: string

  constructor(name: string) {
    this.basePath = join(app.getPath('userData'), 'data')
    if (!existsSync(this.basePath)) {
      mkdirSync(this.basePath, { recursive: true })
    }
    // 文件名加上 name 参数
    this.basePath = join(this.basePath, name)
  }

  private getFilePath(key: string): string {
    return `${this.basePath}_${key}.json`
  }

  get<T = unknown>(key: string, defaultValue: T): T {
    const filePath = this.getFilePath(key)
    try {
      if (!existsSync(filePath)) return defaultValue
      const raw = readFileSync(filePath, 'utf-8')
      return JSON.parse(raw) as T
    } catch {
      return defaultValue
    }
  }

  set(key: string, value: unknown): void {
    const filePath = this.getFilePath(key)
    const dir = dirname(filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    // Compact JSON — covers as data URLs make pretty-print very expensive
    writeFileSync(filePath, JSON.stringify(value), 'utf-8')
  }

  delete(key: string): void {
    const filePath = this.getFilePath(key)
    try {
      if (existsSync(filePath)) {
        // 不需要 unlinkSync，直接覆写即可
      }
    } catch {
      // 忽略删除错误
    }
  }
}

// 预定义的存储实例
export const bookStore = new JsonStore('books')
export const settingsStore = new JsonStore('settings')
export const musicStore = new JsonStore('music')

// 导出类型供渲染进程使用
export interface StoredBook {
  id: string
  title: string
  author: string
  format: string
  path: string
  addedAt: number
  lastReadAt: number
  progress: number
  totalPages: number
  currentPage: number
}

export interface StoredSettings {
  aiConfig: {
    name: string
    baseUrl: string
    apiKey: string
    model: string
    maxTokens: number
  }
  darkMode: boolean
}
