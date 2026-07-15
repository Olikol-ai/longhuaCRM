/**
 * Human-readable course title for UI.
 * API returns `name`; some clients still send/expect `course_name`.
 * Never show raw enum values like basic_beginner as the title.
 */
export function getCourseDisplayName(course, fallback = 'Курс') {
  if (!course || typeof course !== 'object') return fallback;
  const title = String(course.name || course.course_name || '').trim();
  if (title) return title;
  return fallback;
}
