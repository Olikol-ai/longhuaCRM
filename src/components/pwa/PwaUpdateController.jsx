import { useEffect, useCallback, useState } from 'react';
import FrontendUpdateScreen from '@/components/common/FrontendUpdateScreen';
import {
  setPwaUpdateUiHandler,
  activateWaitingServiceWorkerAndReload,
} from '@/lib/pwa/serviceWorkerClient';
import { shouldDeferAppReload, onVideoSessionReloadGateChange } from '@/lib/pwa/reloadGate';
import {
  hardReloadForStaleChunks,
  recordFrontendUpdateEvent,
  saveNavigationStateForUpdate,
} from '@/lib/frontendUpdate';
import { Button } from '@/design-system';

/**
 * React-side update UX: SW waiting + deferred-while-video.
 * Chunk errors still use main.jsx overlay; this covers SW update path.
 * Stage 2: SW updates are confirm-only (Update now / Later) — no auto-reload.
 */
export default function PwaUpdateController() {
  const [phase, setPhase] = useState(null);
  const [reason, setReason] = useState('');

  const close = useCallback(() => {
    setPhase(null);
    setReason('');
  }, []);

  const applyUpdate = useCallback(async () => {
    if (shouldDeferAppReload()) {
      setPhase('deferred');
      return;
    }
    saveNavigationStateForUpdate({ reason: reason || 'sw_update' });
    await activateWaitingServiceWorkerAndReload(reason || 'sw_update');
  }, [reason]);

  useEffect(() => {
    setPwaUpdateUiHandler((nextPhase, nextReason) => {
      setReason(nextReason || '');
      if ((nextPhase === 'updating' || nextPhase === 'available') && shouldDeferAppReload()) {
        setPhase('deferred');
        return;
      }
      // Map legacy 'updating' from SW path → confirm UI
      if (nextPhase === 'updating') {
        setPhase('available');
        return;
      }
      setPhase(nextPhase);
    });
    return () => setPwaUpdateUiHandler(null);
  }, []);

  useEffect(() => {
    return onVideoSessionReloadGateChange((blocked) => {
      if (!blocked && phase === 'deferred') {
        setPhase('available');
        recordFrontendUpdateEvent({
          type: 'pwa_update_after_video',
          reason: reason || 'video_ended',
        });
      }
    });
  }, [phase, reason]);

  if (!phase) return null;

  if (phase === 'deferred') {
    return (
      <div
        className="fixed inset-x-0 top-0 z-[90] px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pointer-events-none"
        data-testid="pwa-update-deferred"
      >
        <div className="pointer-events-auto mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur-sm">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Доступна новая версия</p>
            <p className="text-xs text-muted-foreground">
              Обновление будет выполнено после завершения урока.
            </p>
          </div>
          <Button type="button" intent="ghost" size="sm" onClick={close}>
            Скрыть
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'available') {
    return (
      <FrontendUpdateScreen
        phase="available"
        onReloadNow={() => {
          void applyUpdate();
        }}
        onLater={close}
      />
    );
  }

  return (
    <FrontendUpdateScreen
      phase={phase === 'manual' ? 'manual' : 'updating'}
      onAutoReload={undefined}
      onReloadNow={() => {
        saveNavigationStateForUpdate({ reason: 'manual' });
        void hardReloadForStaleChunks('manual');
      }}
      onGoHome={() => {
        window.location.assign('/');
      }}
    />
  );
}
