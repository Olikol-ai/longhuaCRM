import { createPortal } from "react-dom";

const OPTIONS = [
  {
    value: "this",
    title: "Только это занятие",
    description: "Изменения коснутся только выбранного урока",
  },
  {
    value: "following",
    title: "Это занятие и все последующие",
    description: "Изменится этот урок и все будущие в серии",
  },
  {
    value: "all",
    title: "Всю серию",
    description: "Изменятся все запланированные уроки серии",
  },
];

/**
 * Ask how to apply edits to a weekly recurrence series (calendar-style scopes).
 */
export default function RecurrenceApplyScopeDialog({
  open,
  value,
  onChange,
  onConfirm,
  onCancel,
  title = "Что необходимо изменить?",
}) {
  if (!open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recurrence-scope-title"
      >
        <div className="border-b border-slate-100 dark:border-slate-800 px-5 py-4">
          <h3
            id="recurrence-scope-title"
            className="text-base font-semibold text-slate-800 dark:text-slate-100"
          >
            {title}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Урок входит в еженедельную серию. Выберите область применения.
          </p>
        </div>
        <div className="space-y-2 px-5 py-4">
          {OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                value === opt.value
                  ? "border-brand/40 bg-brand-soft dark:bg-brand-soft/30"
                  : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <input
                type="radio"
                name="recurrence-apply-scope"
                className="mt-1"
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                  {opt.title}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {opt.description}
                </span>
              </span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Применить
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
