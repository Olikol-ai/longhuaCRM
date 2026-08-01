import { Loader2, RefreshCw } from 'lucide-react';

/**
 * User-facing screen when a Vite chunk fails after deploy.
 * Never shows technical error text — that stays in the developer console.
 */
export default function FrontendUpdateScreen({
  phase = 'updating',
  onReloadNow,
  onGoHome,
}) {
  const isUpdating = phase === 'updating';

  return (
    <div
      className="min-h-app flex items-center justify-center bg-background p-6 text-foreground"
      data-testid="frontend-update-screen"
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-md space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand">
          {isUpdating ? (
            <Loader2 className="h-7 w-7 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-7 w-7" aria-hidden />
          )}
        </div>

        {isUpdating ? (
          <>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                Longhua CRM была обновлена
              </h1>
              <p className="text-sm text-muted-foreground sm:text-base">
                Загружаем новую версию…
              </p>
            </div>
            <div
              className="mx-auto h-1.5 w-40 overflow-hidden rounded-full bg-muted"
              aria-hidden
            >
              <div className="h-full w-1/2 animate-pulse rounded-full bg-brand" />
            </div>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Это займёт всего несколько секунд.
            </p>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                Longhua CRM не удалось обновить автоматически
              </h1>
              <p className="text-sm text-muted-foreground">
                Нажмите «Обновить сейчас», чтобы загрузить актуальную версию.
              </p>
            </div>
            <div className="flex flex-col justify-center gap-2 sm:flex-row">
              <button
                type="button"
                onClick={onReloadNow}
                data-testid="frontend-update-reload"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                Обновить сейчас
              </button>
              <button
                type="button"
                onClick={onGoHome}
                data-testid="frontend-update-home"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted"
              >
                На главную
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
