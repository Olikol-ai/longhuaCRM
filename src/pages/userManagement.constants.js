import {
  Users,
  GraduationCap,
  Shield,
  Clock,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { getRoleLabel } from '@/lib/locale-by';
import { displayRole } from '@/lib/user-account-role';

export { displayRole };

export const ROLE_CONFIG = {
  admin: {
    label: getRoleLabel('admin'),
    bg: 'bg-brand-muted dark:bg-brand-soft/40',
    text: 'text-brand dark:text-brand',
    dot: 'bg-brand',
    icon: Shield,
  },
  teacher: {
    label: getRoleLabel('teacher'),
    bg: 'bg-emerald-100 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    icon: GraduationCap,
  },
  student: {
    label: getRoleLabel('student'),
    bg: 'bg-muted',
    text: 'text-foreground',
    dot: 'bg-muted-foreground',
    icon: Users,
  },
  pending: {
    label: getRoleLabel('pending'),
    bg: 'bg-amber-100 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-400',
    icon: Clock,
  },
  user: {
    label: getRoleLabel('user'),
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    dot: 'bg-muted-foreground',
    icon: UserCheck,
  },
  sales_manager: {
    label: getRoleLabel('sales_manager'),
    bg: 'bg-violet-100 dark:bg-violet-950/40',
    text: 'text-violet-700 dark:text-violet-300',
    dot: 'bg-violet-500',
    icon: UserCheck,
  },
  registration: {
    label: getRoleLabel('registration'),
    bg: 'bg-orange-100 dark:bg-orange-950/40',
    text: 'text-orange-700 dark:text-orange-300',
    dot: 'bg-orange-500',
    icon: UserPlus,
  },
};

/** Roles available in admin filters and edit dialog (no legacy tutor roles). */
export const REGISTRY_ROLE_OPTIONS = [
  { value: 'admin', label: ROLE_CONFIG.admin.label },
  { value: 'teacher', label: ROLE_CONFIG.teacher.label },
  { value: 'student', label: ROLE_CONFIG.student.label },
  { value: 'sales_manager', label: ROLE_CONFIG.sales_manager.label },
  { value: 'pending', label: ROLE_CONFIG.pending.label },
  { value: 'user', label: ROLE_CONFIG.user.label },
  { value: 'registration', label: ROLE_CONFIG.registration.label },
];

/** Full role option objects for UserEditDialog selects. */
export const ALL_ROLE_OPTIONS = REGISTRY_ROLE_OPTIONS;

export const REGISTRY_STATUS_OPTIONS = [
  { value: 'active', label: 'Активен' },
  { value: 'pending', label: 'Ожидает подтверждения' },
  { value: 'blocked', label: 'Заблокирован' },
];

/** Account presence filter (distinct from role / entity lifecycle status). */
export const ACCOUNT_STATUS_OPTIONS = [
  { value: 'active_account', label: 'Активный аккаунт' },
  { value: 'no_account', label: 'Без аккаунта' },
  { value: 'pending_registration', label: 'Ожидает регистрации' },
  { value: 'blocked', label: 'Заблокирован' },
];

export const ACCOUNT_STATUS_LABEL = {
  active_account: 'Активный аккаунт',
  no_account: 'Без аккаунта',
  pending_registration: 'Ожидает регистрации',
  blocked: 'Заблокирован',
};

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

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
