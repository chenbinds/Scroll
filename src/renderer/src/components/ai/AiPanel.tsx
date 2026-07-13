import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Sparkles, AlertCircle, Trash2 } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useI18n } from '../../lib/i18n'
import { chatStream, type AiMessage } from '../../lib/aiService'
import { loadAiSession, saveAiSession, clearAiSession, type AiSessionMessage } from '../../lib/aiSessionStorage'

interface ChatMessage extends AiSessionMessage {}

const INPUT_HEIGHT_KEY = 'scroll-ai-input-height'
const INPUT_HEIGHT_MIN = 52
const INPUT_HEIGHT_MAX = 320
const INPUT_HEIGHT_DEFAULT = 72

function loadInputHeight(): number {
  try {
    const raw = localStorage.getItem(INPUT_HEIGHT_KEY)
    if (!raw) return INPUT_HEIGHT_DEFAULT
    const n = Number(raw)
    if (!Number.isFinite(n)) return INPUT_HEIGHT_DEFAULT
    return Math.min(INPUT_HEIGHT_MAX, Math.max(INPUT_HEIGHT_MIN, n))
  } catch {
    return INPUT_HEIGHT_DEFAULT
  }
}

export default function AiPanel() {
  const { t } = useI18n()
  const { aiConfig, currentBook, aiContext, aiDraft, setAiDraft } = useAppStore()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState('')
  const [inputHeight, setInputHeight] = useState(loadInputHeight)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputDragging = useRef(false)
  const bookId = currentBook?.id ?? null

  useEffect(() => {
    let cancelled = false
    void loadAiSession(bookId).then((loaded) => {
      if (!cancelled) setMessages(loaded)
    })
    return () => { cancelled = true }
  }, [bookId])

  useEffect(() => {
    if (messages.length === 0) return
    const timer = setTimeout(() => {
      void saveAiSession(bookId, messages)
    }, 600)
    return () => clearTimeout(timer)
  }, [messages, bookId])

  useEffect(() => {
    if (aiDraft) {
      setInput(aiDraft)
      setAiDraft(null)
    }
  }, [aiDraft, setAiDraft])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  const isConfigured = aiConfig.baseUrl && aiConfig.apiKey && aiConfig.model

  const buildContextMessages = useCallback((): AiMessage[] => {
    const ctx = useAppStore.getState().aiContext
    const contextMsgs: AiMessage[] = []

    if (ctx.bookTitle) {
      let systemMsg = `[Current book: 《${ctx.bookTitle}》]`
      if (ctx.chapter) systemMsg += `\n[Current chapter: ${ctx.chapter}]`
      if (ctx.page != null && ctx.pageTotal != null) {
        systemMsg += `\n[Current page: ${ctx.page}/${ctx.pageTotal}]`
      }
      if (ctx.selection) systemMsg += `\n[User selection]:\n${ctx.selection.slice(0, 2000)}`
      if (ctx.content) systemMsg += `\n[Content preview]:\n${ctx.content.slice(0, 3000)}`
      contextMsgs.push({ role: 'system', content: systemMsg })
    }

    contextMsgs.push(
      ...messages.slice(-10).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    )
    return contextMsgs
  }, [messages])

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
    setStreamingText('')

    try {
      const contextMsgs = buildContextMessages()
      contextMsgs.push({ role: 'user', content: userMsg.content })

      let accumulated = ''
      const reply = await chatStream(
        contextMsgs,
        {
          baseUrl: aiConfig.baseUrl,
          apiKey: aiConfig.apiKey,
          model: aiConfig.model,
          maxTokens: aiConfig.maxTokens
        },
        (chunk) => {
          accumulated += chunk
          setStreamingText(accumulated)
        }
      )

      const finalText = reply || accumulated
      setStreamingText('')
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: finalText, timestamp: Date.now() }
      ])
    } catch (err) {
      setStreamingText('')
      setError(err instanceof Error ? err.message : 'AI request failed')
    } finally {
      setLoading(false)
    }
  }

  const handleClearSession = () => {
    setMessages([])
    setStreamingText('')
    void clearAiSession(bookId)
  }

  useEffect(() => {
    try {
      localStorage.setItem(INPUT_HEIGHT_KEY, String(inputHeight))
    } catch { /* ignore */ }
  }, [inputHeight])

  const onInputResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    inputDragging.current = true
    const startY = e.clientY
    const startH = inputHeight

    const onMove = (ev: MouseEvent) => {
      if (!inputDragging.current) return
      const next = Math.min(
        INPUT_HEIGHT_MAX,
        Math.max(INPUT_HEIGHT_MIN, startH + (startY - ev.clientY))
      )
      setInputHeight(next)
    }
    const onUp = () => {
      inputDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [inputHeight])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-end px-2 pt-1">
        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleClearSession}
            className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-0.5 px-1.5 py-0.5"
            title={t('ai.clearSession')}
          >
            <Trash2 size={10} />
            {t('ai.clearSession')}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
        {!isConfigured && messages.length === 0 && (
          <div className="text-center py-8">
            <Sparkles size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-1">{t('ai.notConfigured')}</p>
            <p className="text-xs text-gray-400 dark:text-gray-600">{t('ai.notConfigured.desc')}</p>
          </div>
        )}

        {isConfigured && messages.length === 0 && !streamingText && (
          <div className="text-center py-8">
            <Sparkles size={32} className="mx-auto text-scroll-400 mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('ai.welcome')} ({aiConfig.name})
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('ai.welcome.hint')}</p>
            {aiContext.selection && (
              <p className="text-xs text-scroll-600 dark:text-scroll-400 mt-2 px-2 line-clamp-3">
                {t('ai.selectionReady')}: {aiContext.selection.slice(0, 80)}…
              </p>
            )}
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

        {streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <p className="whitespace-pre-wrap leading-relaxed">{streamingText}</p>
            </div>
          </div>
        )}

        {loading && !streamingText && (
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

      <div className="relative flex-shrink-0 border-t border-gray-200 dark:border-gray-800">
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label={t('ai.resizeInput')}
          onMouseDown={onInputResizeStart}
          className="absolute top-0 left-0 right-0 z-10 h-2 -translate-y-1/2 cursor-ns-resize
                     flex items-center justify-center group"
        >
          <span className="w-10 h-1 rounded-full bg-gray-300/80 dark:bg-gray-600/80
                           group-hover:bg-scroll-400/70 transition-colors" />
        </div>

        <div className="p-3 pt-2">
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isConfigured ? t('ai.placeholder') : t('ai.placeholder.disabled')}
              disabled={!isConfigured || loading}
              style={{ height: inputHeight }}
              className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-700
                         bg-white dark:bg-gray-800 px-3 py-2 text-sm
                         text-gray-900 dark:text-gray-100
                         placeholder-gray-400 dark:placeholder-gray-600
                         focus:outline-none focus:ring-2 focus:ring-scroll-500/50
                         disabled:opacity-50 overflow-y-auto"
            />
            <button
              onClick={() => { void handleSend() }}
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
    </div>
  )
}
