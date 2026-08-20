import { cn } from '@/lib/utils';
import { offlineStaleCaption } from '@/lib/offline/formatUpdatedAt';

/**
 * Page-level caption when showing IndexedDB snapshot.
 */
export function OfflineSnapshotBanner({
  fromCache,
  updatedAt,
  missing = false,
  emptyLabel = 'Данные пока недоступны без подключения',
  className,
}) {
  if (!fromCache && !missing) return null;

  if (missing) {
    return (
      <div
        data-testid="offline-snapshot-missing"
        className={cn(
          'rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground',
          className,
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      data-testid="offline-snapshot-banner"
      className={cn(
        'rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-foreground',
        className,
      )}
    >
      <p className="font-medium">Офлайн · показаны сохранённые данные</p>
      <p className="text-xs text-muted-foreground">{offlineStaleCaption(updatedAt)}</p>
    </div>
  );
}
