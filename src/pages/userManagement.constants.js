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
    bg: 'bg-brand-muted dark:bg-brand-soft/40',
    text: 'text-brand dark:text-brand',
    dot: 'bg-brand',
    icon: Shield,
  },
  teacher: {
    label: 'Преподаватель',
    bg: 'bg-emerald-100 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    icon: GraduationCap,
  },
  student: {
    label: 'Ученик',
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-700 dark:text-slate-300',
    dot: 'bg-slate-500',
    icon: Users,
  },
  pending: {
    label: 'Ожидает роли',
    bg: 'bg-amber-100 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-400',
    icon: Clock,
  },
  user: {
    label: 'Без роли',
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-300',
    dot: 'bg-slate-400',
    icon: UserCheck,
  },
};

export const ALL_ROLE_OPTIONS = ['admin', 'teacher', 'student', 'pending', 'user'];

/** Nested filters inside Аккаунты — only overview + pending queue (not entity directories). */
export const ACCOUNT_FILTER_TABS = [
  { value: 'all', label: 'Все' },
  { value: 'pending', label: 'Ожидают роли' },
];

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
