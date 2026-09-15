import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, SearchField } from '@/design-system';
import { Filter } from 'lucide-react';

/**
 * Excel-like multi-select column filter with search, select all, apply/reset.
 */
export default function ExcelColumnFilter({
  label,
  options,
  value = [],
  onApply,
  active = false,
  searchable = true,
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [query, setQuery] = useState('');
  const btnRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (open) {
      setDraft(value);
      setQuery('');
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) =>
      String(opt.label ?? '').toLowerCase().includes(q)
      || String(opt.value ?? '').toLowerCase().includes(q),
    );
  }, [options, query]);

  const openMenu = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 260;
    const left = Math.min(rect.left, window.innerWidth - width - 8);
    const top = rect.bottom + 4;
    setPos({ top, left });
    setOpen(true);
  };

  const toggle = (optionValue) => {
    setDraft((prev) =>
      prev.includes(optionValue)
        ? prev.filter((v) => v !== optionValue)
        : [...prev, optionValue],
    );
  };

  const selectAll = () => setDraft(options.map((o) => o.value));
  const clearAll = () => setDraft([]);

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        onClick={openMenu}
        className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors ${
          active ? 'text-brand' : 'text-muted-foreground hover:text-foreground'
        }`}
        aria-expanded={open}
      >
        {label}
        <Filter className={`w-3.5 h-3.5 ${active ? 'text-brand fill-brand/20' : ''}`} />
        {active && <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand" aria-hidden />}
      </button>

      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[120]" onClick={() => setOpen(false)} aria-hidden />
          <div
            className="fixed z-[121] w-[260px] max-w-[calc(100vw-1rem)] rounded-xl border border-border bg-card shadow-xl p-3 space-y-2"
            style={{ top: pos.top, left: pos.left }}
            role="dialog"
            aria-label={`Фильтр: ${label}`}
          >
            {searchable && (
              <SearchField
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск..."
                aria-label={`Поиск в фильтре ${label}`}
              />
            )}
            <div className="flex gap-2 text-xs">
              <button type="button" className="text-brand hover:underline" onClick={selectAll}>
                Выбрать всё
              </button>
              <button type="button" className="text-muted-foreground hover:underline" onClick={clearAll}>
                Снять всё
              </button>
            </div>
            <div className="max-h-52 overflow-y-auto border border-border rounded-lg divide-y divide-border">
              {filteredOptions.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">Ничего не найдено</p>
              ) : filteredOptions.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/60"
                >
                  <input
                    type="checkbox"
                    className="rounded border-border"
                    checked={draft.includes(opt.value)}
                    onChange={() => toggle(opt.value)}
                  />
                  <span className="truncate">{opt.label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                intent="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  onApply([]);
                  setOpen(false);
                }}
              >
                Сбросить
              </Button>
              <Button
                type="button"
                size="sm"
                className="flex-1"
                onClick={() => {
                  onApply(draft);
                  setOpen(false);
                }}
              >
                Применить
              </Button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
