import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import {
  claimChunkAutoReload,
  hardReloadForStaleChunks,
  isChunkLoadError,
} from '@/lib/lazyRetry'

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

if (import.meta.env.PROD) {
  // Catch chunk failures that escape React (rare) and recover once.
  window.addEventListener('unhandledrejection', (event) => {
    if (!isChunkLoadError(event.reason)) return;
    if (!claimChunkAutoReload()) return;
    event.preventDefault();
    void hardReloadForStaleChunks('unhandled');
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // Query param forces browsers to re-fetch sw.js after cache policy bumps.
      navigator.serviceWorker.register('/sw.js?v=20260801c').catch(() => {
        /* installability still works via manifest on supported browsers */
      })
    })
  }
}
