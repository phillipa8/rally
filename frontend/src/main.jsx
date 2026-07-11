import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Apply the saved (or OS-preferred) theme before first paint to avoid a flash.
let storedTheme = null
try {
  storedTheme = localStorage.getItem('rally-theme')
} catch {
  /* storage can be unavailable (blocked site data / some private modes) */
}
document.documentElement.dataset.theme =
  storedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
