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

function normalizeHourlyRateInput(value) {
  if (value === '' || value === null || value === undefined) return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return String(n);
}

function parseHourlyRateForSave(raw) {
  const rateRaw = String(raw ?? '').trim();
  if (rateRaw === '') {
    return { ok: false, error: 'Укажите ставку в час (BYN)' };
  }
  const hourlyRate = Number(rateRaw);
  if (!Number.isFinite(hourlyRate)) {
    return { ok: false, error: 'Ставка в час должна быть числом' };
  }
  if (hourlyRate < 0) {
    return { ok: false, error: 'Ставка в час не может быть отрицательной' };
  }
  return { ok: true, value: hourlyRate };
}

export default function UserEditDialog({ user, open, onOpenChange, onSaved, onMerge }) {
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('info');
  const [teacherRateLoading, setTeacherRateLoading] = useState(false);
  const [teacherRateLoadFailed, setTeacherRateLoadFailed] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    role: 'user',
    status: 'active',
    assignedTeacherId: '',
    hourlyRate: '',
  });

  const userRole = user ? displayRole(user) : '';
  const isTeacher = userRole === 'teacher';
  // teachers.id linked via teachers.user_id — registry exposes teacher_profile_id
  const teacherProfileId = user?.teacher_profile_id || null;
  const studentProfileId = resolveStudentProfileId(user);
  const isStudentCard = Boolean(studentProfileId) || userRole === 'student';
  const isStudentProfileOnly = user?.entry_type === 'student_profile';
  // Edit this user's own teacher profile rate — not an assigned teacher of a student.
  const showOwnTeacherRate = form.role === 'teacher';

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
      hourlyRate: '',
    });
    setTeacherRateLoadFailed(false);
    setTab('info');
  }, [user]);

  useEffect(() => {
    if (!open) {
      setTab('info');
    }
  }, [open]);

  // Load teachers.hourly_rate for THIS user via teacher_profile_id (teachers.id).
  useEffect(() => {
    if (!open || !user) return undefined;
    if (displayRole(user) !== 'teacher' || !teacherProfileId) {
      setTeacherRateLoadFailed(displayRole(user) === 'teacher' && !teacherProfileId);
      setTeacherRateLoading(false);
      return undefined;
    }

    let cancelled = false;
    setTeacherRateLoading(true);
    setTeacherRateLoadFailed(false);

    (async () => {
      try {
        const teacher = await api.teachers.get(teacherProfileId);
        if (cancelled) return;
        const raw = teacher?.hourly_rate ?? teacher?.hourlyRate;
        setForm((f) => ({
          ...f,
          hourlyRate: normalizeHourlyRateInput(raw),
        }));
      } catch {
        if (!cancelled) {
          setTeacherRateLoadFailed(true);
          toast({
            title: 'Не удалось загрузить ставку преподавателя',
            description: 'Профиль преподавателя недоступен. Ставка не будет изменена.',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setTeacherRateLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, user, teacherProfileId]);

  if (!user) return null;

  const canMerge = Boolean(user.mergeable && user.student_profile_id && user.has_account);
  const displayStatusKey = user.display_status || user.account_status || user.status;
  const displayStatusLabel = ACCOUNT_STATUS_LABEL[displayStatusKey]
    || STATUS_OPTIONS.find((s) => s.value === displayStatusKey)?.label
    || displayStatusKey
    || '—';
  const lessonBalance = user.lesson_balance;

  const saveOwnTeacherHourlyRate = async () => {
    if (form.role !== 'teacher') return;
    if (!teacherProfileId) {
      toast({
        title: 'Ставка не сохранена',
        description:
          'У пользователя нет связанного профиля преподавателя (teacher_profile_id). Создайте/привяжите teacher отдельно.',
        variant: 'destructive',
      });
      return;
    }
    if (teacherRateLoadFailed) return;
    const parsed = parseHourlyRateForSave(form.hourlyRate);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }
    await api.teachers.update(teacherProfileId, {
      hourly_rate: parsed.value,
    });
  };

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
        await saveOwnTeacherHourlyRate();
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

          {showOwnTeacherRate ? (
            <Section title="Преподаватель">
              <label className="block text-sm min-w-0">
                <span className="text-muted-foreground">Ставка в час (BYN)</span>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className="flex-1"
                    value={form.hourlyRate}
                    disabled={
                      teacherRateLoading
                      || !teacherProfileId
                      || teacherRateLoadFailed
                    }
                    onChange={(e) => setForm((f) => ({ ...f, hourlyRate: e.target.value }))}
                    data-testid="user-edit-teacher-hourly-rate"
                    placeholder="0"
                  />
                  <span className="shrink-0 text-sm text-muted-foreground">BYN/час</span>
                </div>
                {!teacherProfileId || teacherRateLoadFailed ? (
                  <span className="mt-1 block text-xs text-amber-700 dark:text-amber-400">
                    Профиль преподавателя не найден — ставка не будет сохранена.
                  </span>
                ) : (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Сохраняется в teachers.hourly_rate и используется при расчёте зарплаты.
                  </span>
                )}
              </label>
            </Section>
          ) : null}

          {isStudentCard && (
            <Section title="Обучение">
              <AssignedTeacherSelect
                id="user-edit-assigned-teacher"
                label="Преподаватель"
                value={form.assignedTeacherId}
                onChange={(teacherId) => setForm((f) => ({
                  ...f,
                  assignedTeacherId: teacherId,
                }))}
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
