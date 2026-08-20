import { Loader2, Check, AlertCircle } from 'lucide-react';

const MAP = {
  idle: null,
  saving: {
    icon: Loader2,
    text: 'Сохранение…',
    className: 'text-muted-foreground',
    spin: true,
  },
  saved: {
    icon: Check,
    text: 'Сохранено',
    className: 'text-emerald-600 dark:text-emerald-400',
  },
  error: {
    icon: AlertCircle,
    text: 'Ошибка сохранения',
    className: 'text-rose-600 dark:text-rose-400',
  },
};

export default function AutosaveStatus({ status }) {
  const cfg = MAP[status] || null;
  if (!cfg) return <span className="text-xs text-transparent select-none">—</span>;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${cfg.className}`}
      data-testid="autosave-status"
      aria-live="polite"
    >
      <Icon className={`h-3.5 w-3.5 ${cfg.spin ? 'animate-spin' : ''}`} />
      {cfg.text}
    </span>
  );
}
