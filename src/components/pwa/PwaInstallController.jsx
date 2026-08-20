import { useEffect, useRef, useState } from 'react';
import { Download, Share, Smartphone } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/design-system';
import { iconSize } from '@/design-system/tokens/icon';
import {
  canUseBeforeInstallPrompt,
  dismissInstallPrompt,
  isDisplayStandalone,
  isIosSafariLike,
  shouldOfferInstallUi,
} from '@/lib/pwa/installState';

/**
 * Non-intrusive PWA install UX (Chromium BIP + iOS A2HS guidance).
 * Never claims iOS supports beforeinstallprompt.
 */
export default function PwaInstallController() {
  const deferredPromptRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [iosOpen, setIosOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!shouldOfferInstallUi()) return undefined;

    const onBip = (event) => {
      event.preventDefault();
      deferredPromptRef.current = event;
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', onBip);

    // iOS: no BIP — soft offer after a short delay if not standalone.
    let iosTimer = null;
    if (isIosSafariLike() && !isDisplayStandalone() && shouldOfferInstallUi()) {
      iosTimer = window.setTimeout(() => setVisible(true), 2500);
    }

    const onInstalled = () => {
      deferredPromptRef.current = null;
      setVisible(false);
      dismissInstallPrompt();
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
      if (iosTimer) window.clearTimeout(iosTimer);
    };
  }, []);

  if (!visible || isDisplayStandalone()) return null;

  const isIos = isIosSafariLike();
  const hasBip = Boolean(deferredPromptRef.current) || canUseBeforeInstallPrompt();

  const onDismiss = () => {
    dismissInstallPrompt();
    setVisible(false);
    setIosOpen(false);
  };

  const onInstallClick = async () => {
    if (isIos) {
      setIosOpen(true);
      return;
    }
    const promptEvent = deferredPromptRef.current;
    if (!promptEvent) {
      onDismiss();
      return;
    }
    setBusy(true);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      deferredPromptRef.current = null;
      if (choice?.outcome === 'accepted') {
        setVisible(false);
      } else {
        dismissInstallPrompt();
        setVisible(false);
      }
    } catch {
      dismissInstallPrompt();
      setVisible(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-x-0 z-[80] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none"
        style={{ bottom: 0 }}
        data-testid="pwa-install-banner"
      >
        <div className="pointer-events-auto mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur-sm">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Smartphone className={iconSize.md} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">
              Установить Longhua
            </p>
            <p className="text-xs text-muted-foreground">
              {isIos
                ? 'Добавьте на экран Домой — как приложение'
                : 'Открывать как приложение, без вкладок браузера'}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
            <Button
              type="button"
              intent="ghost"
              size="sm"
              onClick={onDismiss}
              data-testid="pwa-install-dismiss"
            >
              Позже
            </Button>
            <Button
              type="button"
              intent="primary"
              size="sm"
              loading={busy}
              onClick={onInstallClick}
              data-testid="pwa-install-accept"
            >
              {isIos || !hasBip ? (
                <>
                  <Share className={iconSize.sm} aria-hidden />
                  Как установить
                </>
              ) : (
                <>
                  <Download className={iconSize.sm} aria-hidden />
                  Установить
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={iosOpen} onOpenChange={setIosOpen}>
        <DialogContent className="sm:max-w-md" data-testid="pwa-ios-install-dialog">
          <DialogHeader>
            <DialogTitle>Добавить на экран «Домой»</DialogTitle>
            <DialogDescription>
              На iPhone и iPad установка выполняется через Safari — отдельной кнопки
              «Установить» в системе нет.
            </DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
            <li>
              Нажмите кнопку <strong>Поделиться</strong> (квадрат со стрелкой) внизу Safari.
            </li>
            <li>
              Выберите <strong>На экран «Домой»</strong>.
            </li>
            <li>
              Подтвердите <strong>Добавить</strong>.
            </li>
          </ol>
          <DialogFooter>
            <Button type="button" intent="primary" onClick={onDismiss}>
              Понятно
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
