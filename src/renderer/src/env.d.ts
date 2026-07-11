/// <reference types="vite/client" />

import type { ScrollAPI } from '../../../preload/index'

declare global {
  interface Window {
    scrollAPI: ScrollAPI
  }
}
