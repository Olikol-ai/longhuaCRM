import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import FrontendUpdateScreen from '@/components/common/FrontendUpdateScreen'
import {
  claimChunkAutoReloadUnlessVideo,
  finalizeFrontendUpdateRecovery,
  hardReloadForStaleChunks,
  isChunkLoadError,
  logChunkLoadError,
  recordFrontendUpdateEvent,
  saveNavigationStateForUpdate,
} from '@/lib/frontendUpdate'
import { shouldDeferAppReload } from '@/lib/pwa/reloadGate'
import { registerLonghuaServiceWorker } from '@/lib/pwa/serviceWorkerClient'
import { getLhPwaBuildId } from '@/lib/pwa/buildIdentity'

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

function mountDeferredUpdateBanner(reason) {
  let host = document.getElementById('lh-frontend-update-deferred')
  if (host) return
  host = document.createElement('div')
  host.id = 'lh-frontend-update-deferred'
  host.setAttribute('data-testid', 'pwa-update-deferred-boot')
  host.className =
    'fixed inset-x-0 top-0 z-[90] px-3 pt-[max(0.75rem,env(safe-area-inset-top))]'
  host.innerHTML = `
    <div class="mx-auto max-w-lg rounded-2xl border border-border bg-card p-3 shadow-lg">
      <p class="text-sm font-semibold text-foreground">Доступна новая версия</p>
      <p class="text-xs text-muted-foreground mt-1">
        Обновление отложено до конца видеоурока (звонок не прерываем).
      </p>
      <button type="button" class="mt-2 text-xs text-brand underline" data-dismiss>Скрыть</button>
    </div>
  `
  host.querySelector('[data-dismiss]')?.addEventListener('click', () => host.remove())
  document.body.appendChild(host)
  recordFrontendUpdateEvent({ type: 'pwa_update_deferred_boot', reason })
}

if (import.meta.env.PROD) {
  window.addEventListener('unhandledrejection', (event) => {
    if (!isChunkLoadError(event.reason)) return
    event.preventDefault()
    logChunkLoadError(event.reason)
    saveNavigationStateForUpdate({ reason: 'unhandledrejection' })

    if (shouldDeferAppReload()) {
      recordFrontendUpdateEvent({
        type: 'frontend_update_deferred_video',
        reason: 'unhandled_chunk_during_video',
        buildId: getLhPwaBuildId(),
      })
      mountDeferredUpdateBanner('unhandled_chunk_during_video')
      return
    }

    if (!claimChunkAutoReloadUnlessVideo()) {
      recordFrontendUpdateEvent({
        type: 'frontend_update_manual_required',
        reason: 'unhandled_auto_claimed',
      })
      mountFrontendUpdateOverlay('unhandled', 'manual')
      return
    }
    mountFrontendUpdateOverlay('unhandled', 'updating')
  })

  window.addEventListener('load', () => {
    registerLonghuaServiceWorker().catch(() => {})
  })
}
