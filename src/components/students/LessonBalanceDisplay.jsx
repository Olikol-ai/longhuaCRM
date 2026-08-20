import { cn } from "@/lib/utils";
import {
  formatLessonBalance,
  getLessonBalance,
  lessonBalanceBadgeClass,
  lessonBalanceTextClass,
  lessonBalanceTone,
} from "@/lib/lessonBalance";

/**
 * Unified CRM display for lesson-pack balance (students.lesson_balance SSOT).
 *
 * Color rule (everywhere):
 * - green — balance > 0
 * - neutral — balance === 0
 * - red — balance < 0 (debt)
 *
 * Pass `balance` explicitly, or `row` to read via getLessonBalance.
 * Pass `balance={null}` to show the empty label (—).
 *
 * @param {{
 *   balance?: number|null,
 *   row?: object|null,
 *   signed?: boolean,
 *   variant?: 'inline' | 'badge' | 'hero',
 *   showDebtHint?: boolean,
 *   prefix?: React.ReactNode,
 *   suffix?: React.ReactNode,
 *   emptyLabel?: string,
 *   className?: string,
 *   valueClassName?: string,
 *   'data-testid'?: string,
 * }} props
 */
export default function LessonBalanceDisplay({
  balance: balanceProp,
  row = null,
  signed = true,
  variant = "inline",
  showDebtHint = false,
  prefix = null,
  suffix = null,
  emptyLabel = "—",
  className,
  valueClassName,
  "data-testid": dataTestId,
}) {
  const balance =
    balanceProp !== undefined
      ? balanceProp
      : row != null
        ? getLessonBalance(row)
        : null;

  if (balance === null || balance === undefined || !Number.isFinite(Number(balance))) {
    return (
      <span
        className={cn("text-muted-foreground", className)}
        data-testid={dataTestId}
      >
        {prefix}
        {emptyLabel}
        {suffix}
      </span>
    );
  }

  const n = Math.trunc(Number(balance));
  const label = formatLessonBalance(n, { signed });
  const tone = lessonBalanceTone(n);
  const debtHint =
    showDebtHint && tone === "debt" ? (
      <span className="block text-xs text-red-600 dark:text-red-400 mt-1 font-normal">
        Задолженность перед школой
      </span>
    ) : null;

  if (variant === "badge") {
    return (
      <span className={cn("inline-flex flex-col items-start gap-0", className)}>
        <span
          className={cn(
            "inline-flex items-center text-xs font-bold px-2 py-1 rounded-full border",
            lessonBalanceBadgeClass(n),
            valueClassName,
          )}
          data-testid={dataTestId}
        >
          {prefix}
          {label}
          {suffix}
        </span>
        {debtHint}
      </span>
    );
  }

  if (variant === "hero") {
    return (
      <span className={cn("inline-flex flex-col items-start", className)}>
        <span
          className={cn(
            "text-3xl font-bold tabular-nums",
            lessonBalanceTextClass(n),
            valueClassName,
          )}
          data-testid={dataTestId}
        >
          {prefix}
          {label}
          {suffix}
        </span>
        {debtHint}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex flex-col items-start", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-1 tabular-nums",
          lessonBalanceTextClass(n),
          valueClassName,
        )}
        data-testid={dataTestId}
      >
        {prefix}
        {label}
        {suffix}
      </span>
      {debtHint}
    </span>
  );
}
