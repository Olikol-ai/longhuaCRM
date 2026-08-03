/**
 * Completed (conducted) lessons for the current calendar month
 * vs the previous full calendar month.
 *
 * Counts only status === 'completed'. Ignores cancelled, rescheduled,
 * missed*, planned, and any other statuses.
 */

const COMPLETED_STATUSES = new Set(['completed']);

/**
 * @param {unknown} raw
 * @returns {Date | null}
 */
export function parseLessonCalendarDate(raw) {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }
  const s = String(raw).trim();
  // Prefer date-only YYYY-MM-DD to avoid TZ shifts at midnight UTC.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @param {Array<{ status?: string, date?: string }>} lessons
 * @param {Date} [now]
 * @returns {{
 *   currentCount: number,
 *   previousCount: number,
 *   delta: number,
 *   trend: 'up' | 'down' | 'flat',
 *   percentChange: number | null,
 * }}
 */
export function computeCompletedLessonsMonthStats(lessons, now = new Date()) {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const prevAnchor = new Date(currentYear, currentMonth - 1, 1);
  const prevYear = prevAnchor.getFullYear();
  const prevMonth = prevAnchor.getMonth();

  let currentCount = 0;
  let previousCount = 0;

  for (const lesson of lessons || []) {
    if (!COMPLETED_STATUSES.has(lesson?.status)) continue;
    const d = parseLessonCalendarDate(lesson.date);
    if (!d) continue;
    const y = d.getFullYear();
    const m = d.getMonth();
    if (y === currentYear && m === currentMonth) currentCount += 1;
    else if (y === prevYear && m === prevMonth) previousCount += 1;
  }

  const delta = currentCount - previousCount;
  let trend = 'flat';
  if (delta > 0) trend = 'up';
  else if (delta < 0) trend = 'down';

  let percentChange = null;
  if (previousCount > 0) {
    percentChange = Math.round((delta / previousCount) * 100);
  }

  return { currentCount, previousCount, delta, trend, percentChange };
}

function lessonWord(n) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return 'занятий';
  if (last === 1) return 'занятие';
  if (last >= 2 && last <= 4) return 'занятия';
  return 'занятий';
}

/**
 * Compact copy for StatCard footer.
 * @param {ReturnType<typeof computeCompletedLessonsMonthStats>} stats
 */
export function formatCompletedMonthComparison(stats) {
  const { currentCount, previousCount, delta, trend, percentChange } = stats;
  const previousLine = `В прошлом месяце: ${previousCount}`;

  let trendLine = 'Без изменений';
  let trendTone = 'muted';

  if (trend === 'up') {
    const abs = Math.abs(delta);
    const pct =
      percentChange != null && percentChange !== 0 ? ` (${percentChange > 0 ? '+' : ''}${percentChange}%)` : '';
    trendLine = `↑ +${abs} ${lessonWord(abs)}${pct}`;
    trendTone = 'up';
  } else if (trend === 'down') {
    const abs = Math.abs(delta);
    const pct =
      percentChange != null && percentChange !== 0 ? ` (${percentChange}%)` : '';
    trendLine = `↓ −${abs} ${lessonWord(abs)}${pct}`;
    trendTone = 'down';
  } else if (currentCount === 0 && previousCount === 0) {
    trendLine = 'Без изменений';
    trendTone = 'muted';
  }

  return {
    label: 'Проведено в этом месяце',
    value: currentCount,
    previousLine,
    trendLine,
    trendTone,
  };
}
