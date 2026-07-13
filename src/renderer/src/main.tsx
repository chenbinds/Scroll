import ReactDOM from 'react-dom/client'
import './globals.css'
import { hydrateFromBootstrap } from './bootstrapHydrate'

const t0 = performance.now()
console.log('[scroll] boot shell', `${t0.toFixed(0)}ms`)

void Promise.all([import('./App'), hydrateFromBootstrap()]).then(([{ default: App }]) => {
  ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
  console.log('[scroll] react mounted', `${(performance.now() - t0).toFixed(0)}ms`)
})
