import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Compact removable filter chips for mobile/desktop toolbars.
 * @param {{ chips: Array<{ id: string, label: string }>, onRemove: (id: string) => void, onClearAll?: () => void, className?: string }} props
 */
export default function FilterChips({ chips = [], onRemove, onClearAll, className }) {
  if (!chips.length) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => onRemove?.(chip.id)}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1.5 text-xs font-medium text-foreground min-h-[36px]"
          aria-label={`Сбросить фильтр: ${chip.label}`}
        >
          <span className="truncate">{chip.label}</span>
          <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      ))}
      {onClearAll ? (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs font-medium text-brand hover:underline px-1 py-1.5 min-h-[36px]"
        >
          Сбросить всё
        </button>
      ) : null}
    </div>
  );
}
