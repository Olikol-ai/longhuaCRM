import { getLessonStartMs } from './teacherUpcomingLessons.js';

/** Statuses that leave the daily work list (history / reports only). */
export const SCHEDULE_LIST_FINAL_STATUSES = new Set([
  'completed',
  'cancelled',
  'rescheduled',
  'missed',
  'missed_no_notice',
]);

export function getLessonStatus(lesson) {
  return String(lesson?.status || '').toLowerCase();
}

export function isScheduleListFinalStatus(status) {
  return SCHEDULE_LIST_FINAL_STATUSES.has(String(status || '').toLowerCase());
}

/**
 * Active work-list lesson: still needs attention (typically planned).
 * Final statuses are hidden unless includeFinal is true.
 */
export function isScheduleListRelevantLesson(lesson, { includeFinal = false } = {}) {
  if (!lesson) return false;
  const status = getLessonStatus(lesson);
  if (!status) return false;
  if (isScheduleListFinalStatus(status)) return Boolean(includeFinal);
  // Non-final (planned and any future open statuses) stay visible,
  // including overdue planned lessons that still need an action.
  return true;
}

export function compareLessonsByStart(a, b) {
  const aMs = getLessonStartMs(a);
  const bMs = getLessonStartMs(b);
  const aSafe = Number.isFinite(aMs) ? aMs : 0;
  const bSafe = Number.isFinite(bMs) ? bMs : 0;
  if (aSafe !== bSafe) return aSafe - bSafe;
  return String(a?.id || '').localeCompare(String(b?.id || ''));
}

/**
 * Daily schedule «Список» rows: relevant lessons only, sorted soonest first.
 *
 * @param {Array<object>} lessons
 * @param {{ includeFinal?: boolean }} [options]
 */
export function filterScheduleListLessons(lessons, { includeFinal = false } = {}) {
  const list = Array.isArray(lessons) ? lessons : [];
  return list
    .filter((lesson) => isScheduleListRelevantLesson(lesson, { includeFinal }))
    .sort(compareLessonsByStart);
}
