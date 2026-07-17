/** Map IPC / Node file errors to a short user-facing key or message. */
export function fileLoadErrorMessage(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : String(err)
  if (
    raw.includes('FILE_MISSING') ||
    raw.includes('ENOENT') ||
    /no such file or directory/i.test(raw)
  ) {
    return 'FILE_MISSING'
  }
  return fallback + ': ' + raw
}
