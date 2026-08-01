import { normalizeRole } from '../../common/constants/roles';

/** Teachers/tutors must schedule at least this far ahead of lesson start. */
export const LESSON_CREATE_MIN_LEAD_MS = 2 * 60 * 60 * 1000;

export const LESSON_CREATE_LEAD_TIME_MESSAGE =
  'Урок должен быть запланирован не ранее чем за 2 часа до начала';

/**
 * Admin (and system callers with no actor) may create lessons at any lead time.
 * Teacher and Tutor keep the 2-hour advance rule.
 */
export function shouldEnforceLessonCreateLeadTime(
  role: string | null | undefined,
): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'teacher' || normalized === 'tutor';
}

/** Parse school wall-clock date+time the same way as lesson schedulers. */
export function parseLessonWallClock(date: string, startTime: string): Date {
  const [year, month, day] = String(date || '').split('-').map(Number);
  const [hours, minutes] = String(startTime || '00:00')
    .split(':')
    .map(Number);
  return new Date(year, month - 1, day, hours || 0, minutes || 0);
}

/**
 * Wall-clock "now" in school timezone (default Europe/Minsk),
 * aligned with lesson date/start_time storage.
 */
export function getSchoolTimezoneNow(
  timeZone = process.env.REMINDER_TIMEZONE || 'Europe/Minsk',
): Date {
  const now = new Date();
  const localized = new Date(now.toLocaleString('en-US', { timeZone }));
  const offsetMs = localized.getTime() - now.getTime();
  return new Date(now.getTime() + offsetMs);
}

export function isLessonCreateTooSoon(
  date: string,
  startTime: string,
  now: Date = getSchoolTimezoneNow(),
  minLeadMs: number = LESSON_CREATE_MIN_LEAD_MS,
): boolean {
  const start = parseLessonWallClock(date, startTime);
  return start.getTime() - now.getTime() < minLeadMs;
}
