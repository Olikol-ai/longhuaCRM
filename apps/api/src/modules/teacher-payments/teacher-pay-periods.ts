/**
 * Teacher payroll periods = full calendar month of the lesson date (yyyy-MM).
 * Payout date (15th of the next month) is an operational cue, not a period boundary.
 */

export type TeacherPayPeriod = {
  /** Calendar month key, e.g. 2026-07 */
  month: string;
  /** Same as month — stable aggregation key */
  key: string;
  /** First day of month (yyyy-MM-dd) */
  start: string;
  /** Last day of month (yyyy-MM-dd) */
  end: string;
  /** Human label, e.g. «Выплата за июль 2026» */
  label: string;
  /** Operational payout target: 15th of the next month (yyyy-MM-dd) */
  payoutDate: string;
};

export type TeacherPayPeriodTotal = TeacherPayPeriod & {
  amount: number;
  paymentCount: number;
};

export function getTeacherPayPeriodForDate(
  input: string | Date | null | undefined,
): TeacherPayPeriod | null {
  const date = parseLocalDate(input);
  if (!date) return null;

  const year = date.getFullYear();
  const monthIndex = date.getMonth();
  const month = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  const payout = new Date(year, monthIndex + 1, 15);

  return {
    month,
    key: month,
    start: toIsoDate(start),
    end: toIsoDate(end),
    label: formatPayPeriodLabel(year, monthIndex),
    payoutDate: toIsoDate(payout),
  };
}

export function aggregateTeacherPaymentsByPeriod(
  payments: Array<{
    amount?: unknown;
    lessonId?: string | null;
    createdAt?: Date | string | null;
  }>,
  lessonDateById: Map<string, string>,
): TeacherPayPeriodTotal[] {
  const byPeriod = new Map<string, TeacherPayPeriodTotal>();

  for (const payment of payments) {
    const lessonId = payment.lessonId ?? null;
    const lessonDate = lessonId ? lessonDateById.get(lessonId) : undefined;
    const accrualDate =
      lessonDate ||
      (payment.createdAt instanceof Date
        ? toIsoDate(payment.createdAt)
        : payment.createdAt) ||
      null;
    const period = getTeacherPayPeriodForDate(accrualDate);
    if (!period) continue;

    const amount = parseAmount(payment.amount);
    const existing = byPeriod.get(period.key);
    if (existing) {
      existing.amount = Math.round((existing.amount + amount) * 100) / 100;
      existing.paymentCount += 1;
    } else {
      byPeriod.set(period.key, {
        ...period,
        amount,
        paymentCount: 1,
      });
    }
  }

  return [...byPeriod.values()].sort((a, b) => b.month.localeCompare(a.month));
}

function parseAmount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseLocalDate(input: string | Date | null | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null;
    return new Date(input.getFullYear(), input.getMonth(), input.getDate());
  }
  const raw = String(input).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, month, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatPayPeriodLabel(year: number, monthIndex: number): string {
  const formatted = new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, monthIndex, 1));
  return `Выплата за ${formatted}`;
}
