export interface AiSessionMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

function sessionKey(bookId: string | null): string {
  return bookId ? `ai_session_${bookId}` : 'ai_session_global'
}

export async function loadAiSession(bookId: string | null): Promise<AiSessionMessage[]> {
  const key = sessionKey(bookId)
  const data = await window.scrollAPI.storage.get(key, [])
  if (!Array.isArray(data)) return []
  return data.filter(
    (m) =>
      m &&
      typeof m === 'object' &&
      (m.role === 'user' || m.role === 'assistant') &&
      typeof m.content === 'string'
  ) as AiSessionMessage[]
}

export async function saveAiSession(
  bookId: string | null,
  messages: AiSessionMessage[]
): Promise<void> {
  const key = sessionKey(bookId)
  const trimmed = messages.slice(-50)
  await window.scrollAPI.storage.set(key, trimmed)
}

export async function clearAiSession(bookId: string | null): Promise<void> {
  await window.scrollAPI.storage.set(sessionKey(bookId), [])
}
