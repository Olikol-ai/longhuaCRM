function formatTime(value) {
  if (value == null || value === '') return '';
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (!match) return String(value);
  return `${String(Number(match[1])).padStart(2, '0')}:${match[2]}`;
}

function lessonStartMs(lesson) {
  const date = String(lesson?.date || '').slice(0, 10);
  const timeRaw = formatTime(lesson?.start_time ?? lesson?.startTime) || '00:00';
  const ms = Date.parse(`${date}T${timeRaw}:00`);
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Split group lessons by wall-clock start.
 * Caller must already filter by lesson.groupId (not live group_members).
 */
export function splitGroupLessons(lessons, nowMs = Date.now()) {
  const upcoming = [];
  const history = [];
  for (const lesson of lessons || []) {
    if (lessonStartMs(lesson) >= nowMs) {
      upcoming.push(lesson);
    } else {
      history.push(lesson);
    }
  }
  upcoming.sort((a, b) => lessonStartMs(a) - lessonStartMs(b));
  history.sort((a, b) => lessonStartMs(b) - lessonStartMs(a));
  return { upcoming, history };
}
