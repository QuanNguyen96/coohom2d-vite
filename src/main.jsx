import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './css/tailwindcss.css' // 👈 Quan trọng
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
