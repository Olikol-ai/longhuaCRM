/**
 * Teacher payroll periods: 15th → 14th (local calendar dates).
 * Shared business rule for API responses (FE only displays).
 */

export type TeacherPayPeriod = {
  start: string;
  end: string;
  key: string;
  label: string;
};

export type TeacherPayPeriodTotal = TeacherPayPeriod & {
  amount: number;
  paymentCount: number;
};

export function getTeacherPayPeriodForDate(input: string | Date | null | undefined): TeacherPayPeriod | null {
  const date = parseLocalDate(input);
  if (!date) return null;

  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  let start: Date;
  let end: Date;
  if (day >= 15) {
    start = new Date(year, month, 15);
    end = new Date(year, month + 1, 14);
  } else {
    start = new Date(year, month - 1, 15);
    end = new Date(year, month, 14);
  }

  const startIso = toIsoDate(start);
  const endIso = toIsoDate(end);
  return {
    start: startIso,
    end: endIso,
    key: `${startIso}_${endIso}`,
    label: `${formatRuDate(startIso)} — ${formatRuDate(endIso)}`,
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

  return [...byPeriod.values()].sort((a, b) => b.start.localeCompare(a.start));
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

function formatRuDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
}
