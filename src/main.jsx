import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Query param forces browsers to re-fetch sw.js after cache policy bumps.
    navigator.serviceWorker.register('/sw.js?v=20260801b').catch(() => {
      /* installability still works via manifest on supported browsers */
    })
  })
}

