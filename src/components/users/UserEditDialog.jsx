import { useEffect, useState } from 'react';
import { api } from '@/api';
import {
  Button,
  Input,
  ResponsiveDialog,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/design-system';
import { toast } from '@/components/ui/use-toast';
import { ALL_ROLE_OPTIONS, ROLE_CONFIG, ACCOUNT_STATUS_LABEL } from '@/pages/userManagement.constants';
import { displayRole } from '@/lib/user-account-role';
import { getRoleLabel } from '@/lib/locale-by';
import TeacherAvailabilityView from '@/components/teachers/TeacherAvailabilityView';
import AssignedTeacherSelect from '@/components/students/AssignedTeacherSelect';
import { userFacingError } from '@/lib/userFacingError';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Активен' },
  { value: 'pending', label: 'Ожидает подтверждения' },
  { value: 'blocked', label: 'Заблокирован' },
];

const TEACHER_TABS = [
  { id: 'info', label: 'Информация' },
  { id: 'availability', label: 'Свободное расписание' },
];

function Section({ title, children }) {
  return (
    <section className="space-y-3 min-w-0">
      <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">{title}</h3>
      <div className="space-y-3 min-w-0">{children}</div>
    </section>
  );
}

function resolveStudentProfileId(user) {
  if (!user) return null;
  if (user.student_profile_id) return user.student_profile_id;
  if (user.entry_type === 'student_profile') return user.id;
  return null;
}

/** Prefer structured parts; fall back to registry full_name for orphan student cards. */
function seedNameParts(user) {
  const first = String(user?.first_name ?? '').trim();
  const last = String(user?.last_name ?? '').trim();
  if (first || last) {
    return { firstName: first, lastName: last };
  }
  const full = String(user?.full_name ?? '').trim();
  if (full) {
    return { firstName: full, lastName: '' };
  }
  return { firstName: '', lastName: '' };
}

/** Same composition as backend composeDisplayName (Фамилия Имя). */
function composeStudentName(firstName, lastName) {
  const first = String(firstName ?? '').trim();
  const last = String(lastName ?? '').trim();
  if (last && first) return `${last} ${first}`;
  return first || last;
}

export default function UserEditDialog({ user, open, onOpenChange, onSaved, onMerge }) {
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('info');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    role: 'user',
    status: 'active',
    assignedTeacherId: '',
  });

  const userRole = user ? displayRole(user) : '';
  const isTeacher = userRole === 'teacher';
  const teacherProfileId = user?.teacher_profile_id || null;
  const studentProfileId = resolveStudentProfileId(user);
  const isStudentCard = Boolean(studentProfileId) || userRole === 'student';
  const isStudentProfileOnly = user?.entry_type === 'student_profile';

  useEffect(() => {
    if (!user) return;
    const names = seedNameParts(user);
    setForm({
      firstName: names.firstName,
      lastName: names.lastName,
      phone: user.phone || '',
      role: displayRole(user),
      status: user.status || 'active',
      assignedTeacherId: user.assigned_teacher_id || '',
    });
    setTab('info');
  }, [user]);

  useEffect(() => {
    if (!open) {
      setTab('info');
    }
  }, [open]);

  if (!user) return null;

  const canMerge = Boolean(user.mergeable && user.student_profile_id && user.has_account);
  const displayStatusKey = user.display_status || user.account_status || user.status;
  const displayStatusLabel = ACCOUNT_STATUS_LABEL[displayStatusKey]
    || STATUS_OPTIONS.find((s) => s.value === displayStatusKey)?.label
    || displayStatusKey
    || '—';
  const lessonBalance = user.lesson_balance;

  const save = async () => {
    setSaving(true);
    try {
      const firstName = form.firstName.trim();
      const lastName = form.lastName.trim();
      const phone = form.phone.trim();
      const studentName = composeStudentName(firstName, lastName);

      if (isStudentProfileOnly) {
        if (!studentProfileId) {
          throw new Error('Профиль ученика не найден');
        }
        // Registry list uses students.name as SSOT for orphan cards.
        await api.students.update(studentProfileId, {
          name: studentName,
          first_name: firstName,
          last_name: lastName,
          phone,
          assigned_teacher: form.assignedTeacherId || null,
        });
      } else {
        await api.users.update(user.id, {
          firstName,
          lastName,
          phone,
          role: form.role,
          status: form.status,
        });
        if (studentProfileId) {
          // Keep Student.name in sync — enrichRows prefers it over User for full_name.
          await api.students.update(studentProfileId, {
            name: studentName,
            first_name: firstName,
            last_name: lastName,
            phone,
            assigned_teacher: form.assignedTeacherId || null,
          });
        }
      }

      toast({ title: 'Пользователь сохранён' });
      await onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Не удалось сохранить',
        description: userFacingError(err, 'Попробуйте ещё раз'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const currentRoleLabel = ROLE_CONFIG[displayRole(user)]?.label || getRoleLabel(displayRole(user));

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      fullscreenOnMobile
      className="md:max-w-lg overflow-y-auto"
    >
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle className="pr-8 truncate">
          {user.full_name || user.email || 'Пользователь'}
        </ResponsiveDialogTitle>
      </ResponsiveDialogHeader>

      {isTeacher ? (
        <div className="flex gap-1 border-b border-border mb-2 -mx-1 px-1">
          {TEACHER_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={cn(
                'px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors',
                tab === t.id
                  ? 'border-brand text-brand'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}

      {(!isTeacher || tab === 'info') && (
        <div className="space-y-5 px-1 py-2 min-w-0 overflow-x-hidden" role="tabpanel">
          <Section title="Профиль">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm min-w-0">
                <span className="text-muted-foreground">Имя</span>
                <Input
                  className="mt-1"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  data-testid="user-edit-first-name"
                />
              </label>
              <label className="block text-sm min-w-0">
                <span className="text-muted-foreground">Фамилия</span>
                <Input
                  className="mt-1"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  data-testid="user-edit-last-name"
                />
              </label>
            </div>
            <label className="block text-sm min-w-0">
              <span className="text-muted-foreground">Телефон</span>
              <Input
                className="mt-1"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                data-testid="user-edit-phone"
              />
            </label>
            <p className="text-sm text-muted-foreground break-all">
              Email: <span className="text-foreground">{user.email || '—'}</span>
            </p>
          </Section>

          {!isStudentProfileOnly && (
            <Section title="Роль и статус">
              <label className="block text-sm min-w-0">
                <span className="text-muted-foreground">Роль</span>
                <select
                  className="mt-1 w-full min-h-touch rounded-xl border border-border bg-background px-3 text-base"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                >
                  {ALL_ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Сейчас: {currentRoleLabel}
                </span>
              </label>
              <label className="block text-sm min-w-0">
                <span className="text-muted-foreground">Статус аккаунта</span>
                <select
                  className="mt-1 w-full min-h-touch rounded-xl border border-border bg-background px-3 text-base"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <p className="text-sm text-muted-foreground">
                Отображение в реестре: {displayStatusLabel}
              </p>
            </Section>
          )}

          {isStudentCard && (
            <Section title="Обучение">
              <AssignedTeacherSelect
                id="user-edit-assigned-teacher"
                label="Преподаватель"
                value={form.assignedTeacherId}
                onChange={(teacherId) => setForm((f) => ({ ...f, assignedTeacherId: teacherId }))}
                emptyLabel="Не назначен"
                data-testid="user-edit-assigned-teacher"
              />
              {lessonBalance != null ? (
                <p className="text-sm text-foreground">
                  Остаток занятий: <span className="font-medium tabular-nums">{lessonBalance}</span>
                </p>
              ) : null}
            </Section>
          )}
        </div>
      )}

      {isTeacher && tab === 'availability' && (
        <div className="px-1 py-2 min-w-0 overflow-x-hidden" role="tabpanel">
          {teacherProfileId ? (
            <TeacherAvailabilityView teacherId={teacherProfileId} />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Профиль преподавателя не найден
            </p>
          )}
        </div>
      )}

      <ResponsiveDialogFooter>
        {canMerge && tab === 'info' && (
          <Button type="button" intent="outline" onClick={() => onMerge?.()} disabled={saving}>
            Объединить ученика
          </Button>
        )}
        <Button type="button" intent="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          {isTeacher && tab === 'availability' ? 'Закрыть' : 'Отмена'}
        </Button>
        {(!isTeacher || tab === 'info') && (
          <Button type="button" onClick={save} disabled={saving} data-testid="user-edit-save">
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        )}
      </ResponsiveDialogFooter>
    </ResponsiveDialog>
  );
}
