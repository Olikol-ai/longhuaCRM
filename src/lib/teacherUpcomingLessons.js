/**
 * Teacher home: upcoming lessons in the next 48 hours (local time).
 * Window: [now, now + 48h], planned only, sorted by start ascending.
 */

const MS_48H = 48 * 60 * 60 * 1000;

/** Lesson start as local epoch ms from date (yyyy-MM-dd) + start_time (HH:mm). */
export function getLessonStartMs(lesson) {
  if (!lesson?.date) return Number.NaN;
  const [year, month, day] = String(lesson.date).split('-').map(Number);
  if (!year || !month || !day) return Number.NaN;
  const time = String(lesson.start_time || lesson.startTime || '00:00').slice(0, 5);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(
    year,
    month - 1,
    day,
    Number.isFinite(hours) ? hours : 0,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0,
  ).getTime();
}

/**
 * @param {Array<object>} lessons
 * @param {number} [nowMs]
 * @returns {Array<object>}
 */
export function filterLessonsWithinNext48Hours(lessons, nowMs = Date.now()) {
  const endMs = nowMs + MS_48H;
  const list = Array.isArray(lessons) ? lessons : [];

  return list
    .filter((lesson) => {
      if (!lesson || lesson.status === 'cancelled') return false;
      if (lesson.status !== 'planned') return false;
      const startMs = getLessonStartMs(lesson);
      if (!Number.isFinite(startMs)) return false;
      return startMs >= nowMs && startMs <= endMs;
    })
    .sort((a, b) => getLessonStartMs(a) - getLessonStartMs(b));
}
