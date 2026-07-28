/** CRM page that embeds the lesson video provider (Jitsi, etc.). */
export function lessonVideoPath(lessonId) {
  if (!lessonId) return null;
  return `/lesson/${encodeURIComponent(lessonId)}/video`;
}

export function isOnlineLesson(lesson) {
  const format = lesson?.lesson_format ?? lesson?.lessonFormat;
  return format === 'online' || (!format && Boolean(lesson?.video_room_url || lesson?.meeting_link));
}

export function canStartVideoLesson(lesson, now = new Date()) {
  if (!lesson || !isOnlineLesson(lesson)) return { ok: false, reason: 'not_online' };
  const date = String(lesson.date || '').slice(0, 10);
  const time = String(lesson.start_time || lesson.startTime || '00:00').slice(0, 5);
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  if (!y || !m || !d) return { ok: false, reason: 'bad_date' };
  const start = new Date(y, m - 1, d, hh || 0, mm || 0);
  const duration = Number(lesson.duration || 60);
  const end = new Date(start.getTime() + duration * 60_000);
  const t = now.getTime();
  const joinFrom = start.getTime() - 10 * 60_000;
  const joinUntil = end.getTime() + 30 * 60_000;
  if (t < joinFrom) return { ok: false, reason: 'too_early', start };
  if (t > joinUntil) return { ok: true, reason: 'after', start, end };
  return { ok: true, reason: 'during', start, end };
}

export function lessonScheduleFallback(role) {
  if (role === 'student') return '/StudentLessons';
  if (role === 'teacher') return '/TeacherSchedule';
  return '/Dashboard';
}
