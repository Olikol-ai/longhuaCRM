import { useEffect, useState } from 'react';
import { OfflineStatus } from '@/design-system/patterns/OfflineStatus';
import { toast } from '@/components/ui/use-toast';
import {
  bindOfflineNetworkListeners,
  consumeRecoveredToast,
  getOfflineNetworkState,
  subscribeOfflineNetwork,
} from '@/lib/offline/offlineStatus';
import { shouldDeferAppReload } from '@/lib/pwa/reloadGate';

/**
 * Global offline status strip. Never reloads the app; never touches VideoSession/Jitsi/PiP.
 */
export default function OfflineStatusController() {
  const [mode, setMode] = useState(() => getOfflineNetworkState().mode);

  useEffect(() => {
    const unbind = bindOfflineNetworkListeners();
    const unsub = subscribeOfflineNetwork((state) => {
      setMode(state.mode);
      if (consumeRecoveredToast() && !shouldDeferAppReload()) {
        toast({
          title: 'Соединение восстановлено',
          description: 'Данные обновятся в фоне без перезагрузки.',
        });
      }
    });
    return () => {
      unbind();
      unsub();
    };
  }, []);

  if (mode === 'online') return null;

  return (
    <div className="fixed inset-x-0 top-0 pt-[env(safe-area-inset-top)] pointer-events-none">
      <OfflineStatus mode={mode} compact className="pointer-events-none shadow-sm" />
    </div>
  );
}
