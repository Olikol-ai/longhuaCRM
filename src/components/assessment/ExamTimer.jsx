import { formatCountdown } from '@/lib/assessment-ui';

export default function ExamTimer({ remainingSeconds, expired = false }) {
  const urgent = remainingSeconds != null && remainingSeconds <= 300;
  const critical = remainingSeconds != null && remainingSeconds <= 60;

  let tone =
    'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700';
  if (expired || critical) {
    tone =
      'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-200 border-rose-200 dark:border-rose-800';
  } else if (urgent) {
    tone =
      'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border-amber-200 dark:border-amber-800';
  }

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 font-mono text-sm sm:text-base tabular-nums ${tone}`}
      role="timer"
      aria-live="polite"
      data-testid="exam-timer"
    >
      <span className="text-xs uppercase tracking-wide opacity-70 font-sans">Таймер</span>
      <span className="font-semibold">
        {expired || remainingSeconds == null
          ? '00:00'
          : formatCountdown(remainingSeconds)}
      </span>
    </div>
  );
}
