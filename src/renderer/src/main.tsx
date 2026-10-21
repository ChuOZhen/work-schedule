import { createRoot } from 'react-dom/client'
import App from './App'
import { useStore } from './store'
import './styles/base.css'
import './styles/app.css'

// 调试钩子：便于自动化截图与控制台排查
;(window as unknown as { __wsStore: typeof useStore }).__wsStore = useStore

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(<App />)
}
