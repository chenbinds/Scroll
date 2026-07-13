import { useCallback } from 'react'
import { useAppStore } from '../stores/appStore'

const MIN = 60
const MAX = 200
const STEP = 10

export function useReaderFontSize() {
  const fontSize = useAppStore((s) => s.readerFontSize)
  const setReaderFontSize = useAppStore((s) => s.setReaderFontSize)

  const increaseFont = useCallback(
    () => setReaderFontSize(Math.min(fontSize + STEP, MAX)),
    [fontSize, setReaderFontSize]
  )
  const decreaseFont = useCallback(
    () => setReaderFontSize(Math.max(fontSize - STEP, MIN)),
    [fontSize, setReaderFontSize]
  )

  return { fontSize, increaseFont, decreaseFont }
}
