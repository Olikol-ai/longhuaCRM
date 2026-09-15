import { cn } from '@/lib/utils';

/**
 * Touch-friendly multi-select list for mobile filter sheets (not Excel popovers).
 */
export function MobileMultiSelect({
  label,
  options = [],
  value = [],
  onChange,
  className,
}) {
  const selected = Array.isArray(value) ? value : [];

  const toggle = (optionValue) => {
    const next = selected.includes(optionValue)
      ? selected.filter((v) => v !== optionValue)
      : [...selected, optionValue];
    onChange?.(next);
  };

  return (
    <fieldset className={cn('space-y-2 min-w-0', className)}>
      <legend className="text-sm font-semibold text-foreground">{label}</legend>
      <div className="rounded-xl border border-border divide-y divide-border overflow-hidden bg-card">
        {options.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">Нет вариантов</p>
        ) : (
          options.map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex items-center gap-3 px-3 py-3 min-h-touch cursor-pointer hover:bg-muted/50"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  checked={checked}
                  onChange={() => toggle(opt.value)}
                />
                <span className="text-sm text-foreground truncate">{opt.label}</span>
              </label>
            );
          })
        )}
      </div>
    </fieldset>
  );
}

/**
 * Touch-friendly single select for mobile filter sheets.
 */
export function MobileSelectField({
  label,
  value = '',
  onChange,
  options = [],
  emptyLabel = 'Все',
  hideEmpty = false,
  className,
}) {
  return (
    <label className={cn('block space-y-1.5 min-w-0', className)}>
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <select
        className="w-full min-h-touch rounded-xl border border-border bg-background px-3 text-base"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      >
        {!hideEmpty ? <option value="">{emptyLabel}</option> : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </label>
  );
}
