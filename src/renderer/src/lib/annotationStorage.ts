import type { AnnotationsFile } from './annotationTypes'

export function annotationStorageKey(bookId: string): string {
  return `annotations_${bookId}`
}

export function emptyAnnotationsFile(
  bookId: string,
  format: AnnotationsFile['format']
): AnnotationsFile {
  return {
    version: 1,
    bookId,
    format,
    updatedAt: Date.now(),
    strokes: [],
    highlights: []
  }
}

export async function loadAnnotations(bookId: string): Promise<AnnotationsFile | null> {
  const key = annotationStorageKey(bookId)
  const data = await window.scrollAPI.storage.get(key, null)
  if (!data || typeof data !== 'object') return null
  const file = data as AnnotationsFile
  if (file.version !== 1 || file.bookId !== bookId) return null
  return file
}

export async function saveAnnotations(file: AnnotationsFile): Promise<void> {
  const key = annotationStorageKey(file.bookId)
  await window.scrollAPI.storage.set(key, { ...file, updatedAt: Date.now() })
}
