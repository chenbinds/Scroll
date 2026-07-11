import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, AlertCircle } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useI18n } from '../../lib/i18n'
import { chat, type AiMessage } from '../../lib/aiService'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export default function AiPanel() {
  const { t, language } = useI18n()
  const { aiConfig } = useAppStore()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const isConfigured = aiConfig.baseUrl && aiConfig.apiKey && aiConfig.model

  const handleSend = async () => {
    if (!input.trim() || loading) return
    if (!isConfigured) {
      setError(t('ai.placeholder.disabled'))
      return
    }

    const userMsg: ChatMessage = { role: 'user', content: input.trim(), timestamp: Date.now() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setError(null)
    setLoading(true)

    try {
      const ctx = useAppStore.getState().aiContext
      const contextMsgs: AiMessage[] = []

      // Inject book context as system message
      if (ctx.bookTitle) {
        let systemMsg = `[Current book: 《${ctx.bookTitle}》]`
        if (ctx.chapter) systemMsg += `\n[Current chapter: ${ctx.chapter}]`
        if (ctx.content) systemMsg += `\n[Chapter preview (first 3000 chars)]:\n${ctx.content.slice(0, 3000)}`
        contextMsgs.push({ role: 'system', content: systemMsg })
      }

      // Add chat history
      contextMsgs.push(...messages.slice(-10).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      })))
      contextMsgs.push({ role: 'user', content: userMsg.content })

      const reply = await chat(contextMsgs, {
        baseUrl: aiConfig.baseUrl,
        apiKey: aiConfig.apiKey,
        model: aiConfig.model,
        maxTokens: aiConfig.maxTokens
      })

      setMessages((prev) => [...prev, { role: 'assistant', content: reply, timestamp: Date.now() }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI request failed')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
        {!isConfigured && messages.length === 0 && (
          <div className="text-center py-8">
            <Sparkles size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-1">{t('ai.notConfigured')}</p>
            <p className="text-xs text-gray-400 dark:text-gray-600">{t('ai.notConfigured.desc')}</p>
            <div className="mt-3 text-xs text-gray-400 dark:text-gray-600 space-y-0.5">
              <p>{t('ai.notConfigured.providers')}</p>
              <p>{t('ai.notConfigured.list')}</p>
            </div>
          </div>
        )}

        {isConfigured && messages.length === 0 && (
          <div className="text-center py-8">
            <Sparkles size={32} className="mx-auto text-scroll-400 mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('ai.welcome')} ({aiConfig.name})
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('ai.welcome.hint')}</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-scroll-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            }`}>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-red-500 text-xs p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 dark:border-gray-800 p-3">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isConfigured ? t('ai.placeholder') : t('ai.placeholder.disabled')}
            disabled={!isConfigured || loading}
            rows={2}
            className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-700
                       bg-white dark:bg-gray-800 px-3 py-2 text-sm
                       text-gray-900 dark:text-gray-100
                       placeholder-gray-400 dark:placeholder-gray-600
                       focus:outline-none focus:ring-2 focus:ring-scroll-500/50
                       disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading || !isConfigured}
            className="self-end p-2 rounded-lg bg-scroll-500 hover:bg-scroll-600
                       text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1.5">
          {t('ai.inputHint')}
        </p>
      </div>
    </div>
  )
}
