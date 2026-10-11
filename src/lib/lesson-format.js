/**
 * Lesson delivery format helpers (online / offline).
 * Not related to in-app video calling — external meeting_link is optional.
 */

export function isOnlineLesson(lesson) {
  const format = lesson?.lesson_format ?? lesson?.lessonFormat;
  return format === 'online' || (!format && Boolean(lesson?.meeting_link));
}
