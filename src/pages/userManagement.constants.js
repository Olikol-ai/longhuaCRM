import {
  Users,
  GraduationCap,
  Shield,
  Clock,
  UserCheck,
} from 'lucide-react';

export const ROLE_CONFIG = {
  admin: {
    label: 'Администратор',
    bg: 'bg-violet-100',
    text: 'text-violet-700',
    dot: 'bg-violet-500',
    icon: Shield,
  },
  teacher: {
    label: 'Преподаватель',
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    icon: GraduationCap,
  },
  student: {
    label: 'Ученик',
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
    icon: Users,
  },
  pending: {
    label: 'Ожидает роли',
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    dot: 'bg-amber-400',
    icon: Clock,
  },
  user: {
    label: 'Без роли',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    dot: 'bg-slate-400',
    icon: UserCheck,
  },
};

export const ALL_ROLE_OPTIONS = ['admin', 'teacher', 'student', 'pending', 'user'];

export function displayRole(role) {
  if (!role) return 'pending';
  return role;
}

/** Profiles visible in Students tab: active + linked user has student role (or no linked account). */
export function visibleStudents(students, users) {
  const roleByUserId = new Map(users.map((u) => [u.id, displayRole(u.role)]));
  const seenUserIds = new Set();
  return students.filter((s) => {
    if (s.status === 'inactive') return false;
    if (!s.user_id) return true;
    const role = roleByUserId.get(s.user_id);
    if (role !== 'student') return false;
    if (seenUserIds.has(s.user_id)) return false;
    seenUserIds.add(s.user_id);
    return true;
  });
}

/** Profiles visible in Teachers tab: active + linked user has teacher role (or no linked account). */
export function visibleTeachers(teachers, users) {
  const roleByUserId = new Map(users.map((u) => [u.id, displayRole(u.role)]));
  const seenUserIds = new Set();
  return teachers.filter((t) => {
    if (t.status === 'inactive') return false;
    if (!t.user_id) return true;
    const role = roleByUserId.get(t.user_id);
    if (role !== 'teacher') return false;
    if (seenUserIds.has(t.user_id)) return false;
    seenUserIds.add(t.user_id);
    return true;
  });
}

export function showOrphanStudentsNotice(result, toast) {
  const orphans = result?.orphanStudents;
  if (!Array.isArray(orphans) || orphans.length === 0) return;
  const names = orphans.map((s) => s.name).filter(Boolean);
  const preview = names.slice(0, 5).join(', ');
  const more = names.length > 5 ? ` и ещё ${names.length - 5}` : '';
  toast({
    title: 'Есть ученики без преподавателя',
    description: `${orphans.length}: ${preview}${more}`,
    variant: 'destructive',
  });
}
