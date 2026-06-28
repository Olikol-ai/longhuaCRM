/** UTC calendar-date helpers — recurrence math never uses local wall-clock. */

export function parseUtcDateString(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = String(dateStr).split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid date string: ${dateStr}`);
  }
  return { year, month, day };
}

export function formatUtcDateString(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

export function addUtcDays(dateStr: string, days: number): string {
  const { year, month, day } = parseUtcDateString(dateStr);
  return formatUtcDateString(year, month, day + days);
}

export function todayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeSeriesTime(time: string): string {
  const parts = String(time ?? '00:00').split(':');
  const hours = String(Number(parts[0] ?? 0)).padStart(2, '0');
  const minutes = String(Number(parts[1] ?? 0)).padStart(2, '0');
  return `${hours}:${minutes}:00`;
}
