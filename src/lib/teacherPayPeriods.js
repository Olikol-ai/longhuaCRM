import { parseMoneyAmount } from './money.js';

/**
 * Longhua Academy teacher payroll periods run from the 15th to the 14th:
 * 15.01 — 14.02, 15.02 — 14.03, …
 *
 * @param {string | Date} input — lesson/accrual date (YYYY-MM-DD or Date)
 * @returns {{ start: string, end: string, key: string, label: string }}
 */
export function getTeacherPayPeriodForDate(input) {
  const date = parseLocalDate(input);
  if (!date) {
    return null;
  }

  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  let start;
  let end;
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

/**
 * Aggregate per-lesson teacher payment rows into payroll-period totals.
 * Prefers linked lesson.date; falls back to payment created_at.
 *
 * @param {Array<{ id?: string, amount?: unknown, lesson_id?: string, lessonId?: string, created_at?: string, createdAt?: string }>} payments
 * @param {Array<{ id?: string, date?: string }> | Map<string, { date?: string }>} lessonsOrById
 * @returns {Array<{ key: string, start: string, end: string, label: string, amount: number, paymentCount: number }>}
 */
export function aggregateTeacherPaymentsByPeriod(payments, lessonsOrById = []) {
  const lessonById = toLessonMap(lessonsOrById);
  const byPeriod = new Map();

  for (const payment of Array.isArray(payments) ? payments : []) {
    const lessonId = payment.lesson_id || payment.lessonId || null;
    const lesson = lessonId ? lessonById.get(lessonId) : null;
    const accrualDate =
      lesson?.date ||
      payment.created_at ||
      payment.createdAt ||
      null;
    const period = getTeacherPayPeriodForDate(accrualDate);
    if (!period) continue;

    const amount = parseMoneyAmount(payment.amount);
    const existing = byPeriod.get(period.key);
    if (existing) {
      existing.amount = Math.round((existing.amount + amount) * 100) / 100;
      existing.paymentCount += 1;
    } else {
      byPeriod.set(period.key, {
        key: period.key,
        start: period.start,
        end: period.end,
        label: period.label,
        amount,
        paymentCount: 1,
      });
    }
  }

  return [...byPeriod.values()].sort((a, b) => b.start.localeCompare(a.start));
}

function toLessonMap(lessonsOrById) {
  if (lessonsOrById instanceof Map) {
    return lessonsOrById;
  }
  const map = new Map();
  for (const lesson of Array.isArray(lessonsOrById) ? lessonsOrById : []) {
    if (lesson?.id) {
      map.set(lesson.id, lesson);
    }
  }
  return map;
}

/** Parse YYYY-MM-DD (or Date/ISO) as a local calendar date. */
export function parseLocalDate(input) {
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

function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatRuDate(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
}
