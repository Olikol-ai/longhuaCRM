export default function ExamProgress({ current, total, answeredCount }) {
  const safeTotal = Math.max(total || 0, 1);
  const pct = Math.round(((answeredCount || 0) / safeTotal) * 100);

  return (
    <div className="space-y-2" data-testid="exam-progress">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <p className="font-medium text-slate-800 dark:text-slate-100">
          Вопрос {current} из {total}
        </p>
        <p className="text-slate-500 dark:text-slate-400">
          Отвечено: {answeredCount} / {total} ({pct}%)
        </p>
      </div>
      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
