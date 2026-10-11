import { createPortal } from "react-dom";
import {
  DELETE_SCOPE_OPTIONS,
  DELETE_SCOPE_OPTIONS_ONE_OFF,
  STATUS_SCOPE_OPTIONS,
  isFutureDeleteScope,
  isSeriesWideScope,
} from "@/lib/lessonSeriesScope";

const EDIT_OPTIONS = [
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
 * Ask how to apply edits / status changes / deletes.
 *
 * @param {'edit'|'status'|'delete'} [mode='edit']
 * @param {boolean} [inSeries=true] — for delete mode, which option set to show
 * @param {string|null} [deleteWarningSummary]
 */
export default function RecurrenceApplyScopeDialog({
  open,
  value,
  onChange,
  onConfirm,
  onCancel,
  mode = "edit",
  title,
  confirmLabel,
  subtitle,
  inSeries = true,
  deleteWarningSummary = null,
  futurePreviewLoading = false,
  confirmDisabled = false,
}) {
  if (!open) return null;

  const deleteOptions = inSeries
    ? DELETE_SCOPE_OPTIONS
    : DELETE_SCOPE_OPTIONS_ONE_OFF;

  const options =
    mode === "status"
      ? STATUS_SCOPE_OPTIONS
      : mode === "delete"
        ? deleteOptions
        : EDIT_OPTIONS;

  const heading =
    title ||
    (mode === "status"
      ? "Отменить:"
      : mode === "delete"
        ? "Удалить занятие"
        : "Что необходимо изменить?");

  const helperText =
    subtitle ||
    (mode === "delete"
      ? "Выберите, что удалить из расписания."
      : "Урок входит в еженедельную серию. Выберите область применения.");

  const resolvedConfirmLabel =
    confirmLabel ||
    (mode === "delete"
      ? "Удалить"
      : mode === "status"
        ? "Применить"
        : "Применить");

  const confirmDanger =
    mode === "delete" &&
    (isSeriesWideScope(value) || isFutureDeleteScope(value));

  const modal = (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recurrence-scope-title"
        data-testid="recurrence-apply-scope-dialog"
        data-mode={mode}
      >
        <div className="border-b border-border px-5 py-4">
          <h3
            id="recurrence-scope-title"
            className="text-base font-semibold text-foreground"
          >
            {heading}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">{helperText}</p>
        </div>
        <div className="space-y-2 px-5 py-4">
          {options.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                value === opt.value
                  ? confirmDanger &&
                    (opt.value === "all" ||
                      opt.value === "future" ||
                      opt.value === "series")
                    ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40"
                    : "border-brand/40 bg-brand-soft dark:bg-brand-soft/30"
                  : "border-border hover:bg-muted"
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
                <span className="block text-sm font-medium text-foreground">
                  {opt.title}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {opt.description}
                </span>
              </span>
            </label>
          ))}
          {mode === "delete" && deleteWarningSummary ? (
            <p
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
              data-testid="delete-scope-warning"
            >
              {futurePreviewLoading ? "Подсчёт занятий…" : deleteWarningSummary}
            </p>
          ) : null}
          {mode === "delete" &&
          (isFutureDeleteScope(value) || value === "series") &&
          futurePreviewLoading &&
          !deleteWarningSummary ? (
            <p
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
              data-testid="delete-scope-warning"
            >
              Подсчёт занятий…
            </p>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted dark:text-muted-foreground dark:hover:bg-slate-800"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled || futurePreviewLoading}
            data-testid="recurrence-apply-scope-confirm"
            className={`rounded-lg px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 ${
              mode === "delete"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-primary hover:bg-primary/90"
            }`}
          >
            {resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
