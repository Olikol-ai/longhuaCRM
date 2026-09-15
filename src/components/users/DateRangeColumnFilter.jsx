import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input } from '@/design-system';
import { Filter } from 'lucide-react';

export const DATE_RANGE_PRESETS = [
  { id: 'today', label: 'Сегодня' },
  { id: '7d', label: 'Последние 7 дней' },
  { id: '30d', label: 'Последние 30 дней' },
  { id: 'month', label: 'Этот месяц' },
  { id: 'custom', label: 'Произвольный диапазон' },
];

export function resolveDateRangePreset(preset) {
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (preset) {
    case 'today': {
      const from = startOfDay(now);
      return { from: from.toISOString(), to: endOfDay(now).toISOString(), preset: 'today' };
    }
    case '7d': {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 6);
      return { from: from.toISOString(), to: endOfDay(now).toISOString(), preset: '7d' };
    }
    case '30d': {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 29);
      return { from: from.toISOString(), to: endOfDay(now).toISOString(), preset: '30d' };
    }
    case 'month': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      return { from: from.toISOString(), to: to.toISOString(), preset: 'month' };
    }
    default:
      return { from: '', to: '', preset: '' };
  }
}

export default function DateRangeColumnFilter({
  label = 'Дата регистрации',
  value = { from: '', to: '', preset: '' },
  onApply,
  active = false,
}) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState(value.preset || '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const btnRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    setPreset(value.preset || '');
    setFrom(value.from ? value.from.slice(0, 10) : '');
    setTo(value.to ? value.to.slice(0, 10) : '');
  }, [open, value]);

  const openMenu = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 280) });
    setOpen(true);
  };

  const apply = () => {
    if (preset && preset !== 'custom') {
      onApply(resolveDateRangePreset(preset));
      setOpen(false);
      return;
    }
    const fromIso = from ? new Date(`${from}T00:00:00`).toISOString() : '';
    const toIso = to ? new Date(`${to}T23:59:59`).toISOString() : '';
    onApply({ from: fromIso, to: toIso, preset: from || to ? 'custom' : '' });
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        onClick={openMenu}
        className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide ${
          active ? 'text-brand' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {label}
        <Filter className={`w-3.5 h-3.5 ${active ? 'text-brand fill-brand/20' : ''}`} />
        {active && <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand" />}
      </button>

      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[120]" onClick={() => setOpen(false)} aria-hidden />
          <div
            className="fixed z-[121] w-[280px] max-w-[calc(100vw-1rem)] rounded-xl border border-border bg-card shadow-xl p-3 space-y-3"
            style={{ top: pos.top, left: pos.left }}
          >
            <div className="space-y-1">
              {DATE_RANGE_PRESETS.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="date-preset"
                    checked={preset === p.id}
                    onChange={() => setPreset(p.id)}
                  />
                  {p.label}
                </label>
              ))}
            </div>
            {(preset === 'custom' || !preset) && (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs space-y-1">
                  <span className="text-muted-foreground">С</span>
                  <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset('custom'); }} />
                </label>
                <label className="text-xs space-y-1">
                  <span className="text-muted-foreground">По</span>
                  <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset('custom'); }} />
                </label>
              </div>
            )}
            <div className="flex gap-2">
              <Button type="button" intent="outline" size="sm" className="flex-1" onClick={() => { onApply({ from: '', to: '', preset: '' }); setOpen(false); }}>
                Сбросить
              </Button>
              <Button type="button" size="sm" className="flex-1" onClick={apply}>
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
