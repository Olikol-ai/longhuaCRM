import { useEffect, useRef } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/design-system';

const AUTO_RELOAD_MS = 800;

/**
 * Single reusable UI for all frontend-update flows after deploy.
 * Never renders technical error text.
 *
 * phases:
 * - updating: auto-reload in progress (chunk recovery)
 * - manual: auto failed — reload / home
 * - available: SW update waiting — reload now / later (no auto)
 */
export default function FrontendUpdateScreen({
  phase = 'updating',
  onAutoReload,
  onReloadNow,
  onGoHome,
  onLater,
}) {
  const isUpdating = phase === 'updating';
  const isAvailable = phase === 'available';
  const startedRef = useRef(false);

  useEffect(() => {
    if (!isUpdating || typeof onAutoReload !== 'function') return undefined;
    if (startedRef.current) return undefined;
    startedRef.current = true;
    const timer = window.setTimeout(() => {
      void onAutoReload();
    }, AUTO_RELOAD_MS);
    return () => window.clearTimeout(timer);
  }, [isUpdating, onAutoReload]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex min-h-app items-center justify-center overflow-hidden bg-background p-6 text-foreground safe-pt safe-pb"
      data-testid="frontend-update-screen"
      data-phase={phase}
      role="status"
      aria-live="polite"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand/10 via-transparent to-transparent"
        aria-hidden
      />

      <div className="relative w-full max-w-md space-y-6 rounded-2xl border border-border bg-card/95 p-6 text-center shadow-sm backdrop-blur-sm sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand ring-1 ring-brand/20">
          {isUpdating ? (
            <Loader2 className="h-7 w-7 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-7 w-7" aria-hidden />
          )}
        </div>

        {isUpdating ? (
          <>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
                Longhua CRM
              </p>
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Longhua CRM была обновлена
              </h1>
              <p className="text-sm text-muted-foreground sm:text-base">
                Загружаем новую версию приложения...
              </p>
            </div>

            <div className="mx-auto h-1.5 w-44 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full w-2/3 animate-pulse rounded-full bg-brand" />
            </div>

            <p className="text-xs text-muted-foreground sm:text-sm">
              Это займёт всего несколько секунд.
            </p>
          </>
        ) : isAvailable ? (
          <>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
                Longhua CRM
              </p>
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Доступна новая версия Longhua CRM
              </h1>
              <p className="text-sm text-muted-foreground">
                Обновите приложение, чтобы продолжить работу на актуальной версии.
              </p>
            </div>

            <div className="flex flex-col justify-center gap-2 sm:flex-row">
              <Button
                type="button"
                intent="primary"
                onClick={onReloadNow}
                data-testid="frontend-update-reload"
              >
                Обновить сейчас
              </Button>
              <Button
                type="button"
                intent="secondary"
                onClick={onLater}
                data-testid="frontend-update-later"
              >
                Позже
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
                Longhua CRM
              </p>
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Longhua CRM не удалось обновить автоматически
              </h1>
              <p className="text-sm text-muted-foreground">
                Нажмите «Обновить сейчас», чтобы загрузить актуальную версию.
              </p>
            </div>

            <div className="flex flex-col justify-center gap-2 sm:flex-row">
              <Button
                type="button"
                intent="primary"
                onClick={onReloadNow}
                data-testid="frontend-update-reload"
              >
                Обновить сейчас
              </Button>
              <Button
                type="button"
                intent="secondary"
                onClick={onGoHome}
                data-testid="frontend-update-home"
              >
                На главную
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
