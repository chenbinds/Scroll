/**
 * AI 服务 — OpenAI 兼容协议客户端
 *
 * 所有 AI 请求通过 Electron 主进程代理，避免渲染进程 CORS 限制。
 * 支持所有兼容 OpenAI 协议的 API 服务（DeepSeek、OpenAI、通义千问、Moonshot 等）。
 */

import type { AiChatParams } from '../../preload/index'

export interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiChatOptions {
  baseUrl: string
  apiKey: string
  model: string
  maxTokens?: number
}

/**
 * 发送聊天请求
 */
export async function chat(
  messages: AiMessage[],
  options: AiChatOptions
): Promise<string> {
  const params: AiChatParams = {
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
    model: options.model,
    messages,
    maxTokens: options.maxTokens || 4096
  }

  const result = await window.scrollAPI.aiChat(params)
  return result.choices?.[0]?.message?.content || ''
}

/**
 * 流式聊天 — 主进程 SSE，逐 chunk 回调
 */
export async function chatStream(
  messages: AiMessage[],
  options: AiChatOptions,
  onChunk: (text: string) => void
): Promise<string> {
  const params: AiChatParams = {
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
    model: options.model,
    messages,
    maxTokens: options.maxTokens || 4096
  }

  const result = await window.scrollAPI.aiChatStream(params, onChunk)
  return result.content || ''
}

/**
 * 测试 API 连通性
 */
export async function testConnection(options: Omit<AiChatOptions, 'maxTokens'>): Promise<void> {
  await window.scrollAPI.aiTestConnection({
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
    model: options.model
  })
}

/**
 * 快速问答 — 单轮对话
 */
export async function ask(
  question: string,
  context: string,
  options: AiChatOptions
): Promise<string> {
  const messages: AiMessage[] = [
    {
      role: 'system',
      content: `你是一个阅读助手。根据提供的书籍内容回答用户问题。

规则：
1. 只根据提供的上下文回答，不要编造信息
2. 如果上下文中没有相关信息，诚实告知
3. 回答简洁、准确，使用中文
4. 引用原文时标注出处（如可用）

上下文：
${context.slice(0, 8000)}`
    },
    { role: 'user', content: question }
  ]

  return chat(messages, options)
}

/**
 * 生成摘要
 */
export async function summarize(
  content: string,
  options: AiChatOptions
): Promise<string> {
  const messages: AiMessage[] = [
    {
      role: 'system',
      content: `你是一个阅读助手。请为以下内容生成一段简洁的摘要（200-500字），
包含：核心观点、关键论据、重要结论。使用中文。`
    },
    { role: 'user', content: content.slice(0, 15000) }
  ]

  return chat(messages, options)
}

/**
 * 翻译文本
 */
export async function translate(
  text: string,
  targetLang: string,
  options: AiChatOptions
): Promise<string> {
  const messages: AiMessage[] = [
    {
      role: 'system',
      content: `你是一个翻译助手。将以下文本翻译成${targetLang}。
保持原文的语气和风格。只输出翻译结果，不要加任何解释。`
    },
    { role: 'user', content: text }
  ]

  return chat(messages, options)
}

/**
 * 解释概念
 */
export async function explain(
  term: string,
  context: string,
  options: AiChatOptions
): Promise<string> {
  const messages: AiMessage[] = [
    {
      role: 'system',
      content: `你是一个知识助手。根据上下文解释用户选中的术语或概念。
用通俗易懂的中文，2-5句话即可。如果上下文信息不足，可以用你的知识补充，
但要标注哪些来自上下文，哪些来自你的知识。`
    },
    { role: 'user', content: `上下文：${context.slice(0, 3000)}\n\n请解释："${term}"` }
  ]

  return chat(messages, options)
}

// ============================================================
// 工具函数（保留供未来扩展）
// ============================================================
