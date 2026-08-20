import { formatDirectPresence } from '@/lib/presence-format';

/** Longhua header line. Last-seen copy stays in presence-format (tested). */
export function formatChatPresence(lastSeenAt, isOnline) {
  if (isOnline) return 'На платформе';
  return formatDirectPresence(lastSeenAt, false);
}

export function formatGroupPresence(memberCount, onlineCount) {
  const members = memberCount ?? 0;
  const online = onlineCount ?? 0;
  if (online > 0) return `${members} участников · ${online} на платформе`;
  return `${members} участников`;
}

export function roleLabel(role) {
  if (role === 'admin') return 'Администратор';
  if (role === 'teacher') return 'Преподаватель';
  if (role === 'tutor') return 'Репетитор';
  if (role === 'student' || role === 'tutor_student') return 'Ученик';
  return 'Участник';
}

export function isTeacherRole(role) {
  return role === 'teacher' || role === 'tutor' || role === 'admin';
}
