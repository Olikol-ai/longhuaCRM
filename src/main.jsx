import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import FrontendUpdateScreen from '@/components/common/FrontendUpdateScreen'
import {
  claimChunkAutoReload,
  finalizeFrontendUpdateRecovery,
  hardReloadForStaleChunks,
  isChunkLoadError,
  logChunkLoadError,
  recordFrontendUpdateEvent,
  saveNavigationStateForUpdate,
} from '@/lib/frontendUpdate'

finalizeFrontendUpdateRecovery()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

function mountFrontendUpdateOverlay(reason, phase = 'updating') {
  let host = document.getElementById('lh-frontend-update-root')
  if (!host) {
    host = document.createElement('div')
    host.id = 'lh-frontend-update-root'
    document.body.appendChild(host)
  }
  const root = ReactDOM.createRoot(host)
  root.render(
    <FrontendUpdateScreen
      phase={phase}
      onAutoReload={
        phase === 'updating' ? () => hardReloadForStaleChunks(reason) : undefined
      }
      onReloadNow={() => hardReloadForStaleChunks('manual')}
      onGoHome={() => {
        window.location.assign('/')
      }}
    />,
  )
}

if (import.meta.env.PROD) {
  window.addEventListener('unhandledrejection', (event) => {
    if (!isChunkLoadError(event.reason)) return
    event.preventDefault()
    logChunkLoadError(event.reason)
    saveNavigationStateForUpdate({ reason: 'unhandledrejection' })
    if (!claimChunkAutoReload()) {
      recordFrontendUpdateEvent({
        type: 'frontend_update_manual_required',
        reason: 'unhandled_auto_claimed',
      })
      mountFrontendUpdateOverlay('unhandled', 'manual')
      return
    }
    mountFrontendUpdateOverlay('unhandled', 'updating')
  })

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js?v=20260801d').catch(() => {
        /* installability still works via manifest on supported browsers */
      })
    })
  }
}
