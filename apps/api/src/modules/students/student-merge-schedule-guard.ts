/**
 * Pure schedule equality checks used by student merge to refuse mutating
 * lesson date/time/recurrence as a side-effect of FK reassignment.
 */

export type LessonScheduleSnapshotRow = {
  id: string;
  date: string;
  start_time: string;
  duration: number;
  recurrence_series_id: string | null;
};

export type RecurrenceScheduleSnapshotRow = {
  id: string;
  weekday: number;
  start_date: string;
  start_time: string;
  duration: number;
  until_date: string | null;
};

export function lessonScheduleRowsEqual(
  before: LessonScheduleSnapshotRow[],
  after: LessonScheduleSnapshotRow[],
): boolean {
  if (before.length !== after.length) return false;
  for (let i = 0; i < before.length; i += 1) {
    const a = before[i];
    const b = after[i];
    if (
      a.id !== b.id
      || String(a.date).slice(0, 10) !== String(b.date).slice(0, 10)
      || String(a.start_time).slice(0, 5) !== String(b.start_time).slice(0, 5)
      || Number(a.duration) !== Number(b.duration)
      || (a.recurrence_series_id ?? null) !== (b.recurrence_series_id ?? null)
    ) {
      return false;
    }
  }
  return true;
}

export function recurrenceScheduleRowsEqual(
  before: RecurrenceScheduleSnapshotRow[],
  after: RecurrenceScheduleSnapshotRow[],
): boolean {
  if (before.length !== after.length) return false;
  for (let i = 0; i < before.length; i += 1) {
    const a = before[i];
    const b = after[i];
    if (
      a.id !== b.id
      || Number(a.weekday) !== Number(b.weekday)
      || String(a.start_date).slice(0, 10) !== String(b.start_date).slice(0, 10)
      || String(a.start_time).slice(0, 5) !== String(b.start_time).slice(0, 5)
      || Number(a.duration) !== Number(b.duration)
      || String(a.until_date ?? '') !== String(b.until_date ?? '')
    ) {
      return false;
    }
  }
  return true;
}

/** Saturday 14:00 must stay Saturday 14:00 after merge (regression fixture). */
export function isSaturdayFourteenHundred(row: {
  date: string;
  start_time: string;
}): boolean {
  const date = String(row.date).slice(0, 10);
  const time = String(row.start_time).slice(0, 5);
  const [y, m, d] = date.split('-').map(Number);
  const utcDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const weekdayMon0 = utcDay === 0 ? 6 : utcDay - 1;
  return weekdayMon0 === 5 && time === '14:00';
}
