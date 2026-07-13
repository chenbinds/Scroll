import ReactDOM from 'react-dom/client'
import App from './App'
import './globals.css'

console.log('[scroll] renderer module evaluated')

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
