import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/api';
import {
  Button,
  EmptyState,
  PageLoading,
  SearchField,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/design-system';
import ExcelColumnFilter from '@/components/users/ExcelColumnFilter';
import DateRangeColumnFilter from '@/components/users/DateRangeColumnFilter';
import UserEditDialog from '@/components/users/UserEditDialog';
import StudentMergeDialog from '@/components/users/StudentMergeDialog';
import StudentFormDialog from '@/components/students/StudentFormDialog';
import MobileFilterToolbar from '@/components/responsive/MobileFilterToolbar';
import { MobileMultiSelect, MobileSelectField } from '@/components/responsive/MobileFilterFields';
import MobileFilterChips from '@/components/responsive/MobileFilterChips';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  buildRegistryQuery,
  getUserDisplayName,
  hasActiveFilters,
  parseRegistryFilters,
  serializeRegistryFilters,
  toggleSort,
} from '@/lib/user-registry.utils';
import { userFacingError } from '@/lib/userFacingError';
import { displayRole } from '@/lib/user-account-role';
import { toast } from '@/components/ui/use-toast';
import {
  Loader2,
  Trash2,
  Users,
  UserPlus,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  MoreVertical,
} from 'lucide-react';
import {
  PAGE_SIZE_OPTIONS,
  REGISTRY_ROLE_OPTIONS,
  REGISTRY_STATUS_OPTIONS,
  ACCOUNT_STATUS_OPTIONS,
  ACCOUNT_STATUS_LABEL,
  ROLE_CONFIG,
  showOrphanStudentsNotice,
} from './userManagement.constants';

function RoleBadge({ user, role }) {
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.user;
  const Icon = cfg.icon;
  const accountHint = user?.entry_type === 'student_profile'
    ? ' · Без аккаунта'
    : role === 'student' && user?.has_account
      ? ' · Аккаунт'
      : '';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <Icon className="w-3 h-3" /> {cfg.label}{accountHint}
    </span>
  );
}

function StatusBadge({ user }) {
  const key = user?.display_status || user?.account_status || user?.status;
  const label = ACCOUNT_STATUS_LABEL[key]
    || REGISTRY_STATUS_OPTIONS.find((s) => s.value === key)?.label
    || key;
  const cls = key === 'active_account' || key === 'active'
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
    : key === 'blocked'
      ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
      : key === 'no_account'
        ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
  return <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold ${cls}`}>{label}</span>;
}

function formatContact(value) {
  if (value == null || value === '') return '—';
  return value;
}

function formatLessonBalance(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return `${n} зан.`;
}

function SortIndicator({ active, dir }) {
  if (!active) return null;
  return dir === 'asc'
    ? <ChevronUp className="w-3.5 h-3.5 inline" />
    : <ChevronDown className="w-3.5 h-3.5 inline" />;
}

function draftFromFilters(filters) {
  return {
    roles: [...(filters.roles || [])],
    accountStatuses: [...(filters.accountStatuses || [])],
    statuses: [...(filters.statuses || [])],
    assignedTeacherId: filters.assignedTeacherId || '',
    createdFrom: filters.createdFrom || '',
    createdTo: filters.createdTo || '',
    datePreset: filters.datePreset || '',
  };
}

function buildFilterChips(filters, teacherOptions) {
  const chips = [];
  for (const role of filters.roles || []) {
    const label = REGISTRY_ROLE_OPTIONS.find((r) => r.value === role)?.label || role;
    chips.push({ id: `role:${role}`, label: `Роль: ${label}` });
  }
  for (const status of filters.accountStatuses || []) {
    const label = ACCOUNT_STATUS_OPTIONS.find((s) => s.value === status)?.label || status;
    chips.push({ id: `accountStatus:${status}`, label: `Аккаунт: ${label}` });
  }
  for (const status of filters.statuses || []) {
    const label = REGISTRY_STATUS_OPTIONS.find((s) => s.value === status)?.label || status;
    chips.push({ id: `status:${status}`, label: `Статус: ${label}` });
  }
  if (filters.assignedTeacherId) {
    const label = teacherOptions.find((t) => t.value === filters.assignedTeacherId)?.label
      || filters.assignedTeacherId;
    chips.push({ id: 'teacher', label: `Преподаватель: ${label}` });
  }
  if (filters.createdFrom || filters.createdTo) {
    const from = filters.createdFrom
      ? new Date(filters.createdFrom).toLocaleDateString('ru-RU')
      : '…';
    const to = filters.createdTo
      ? new Date(filters.createdTo).toLocaleDateString('ru-RU')
      : '…';
    chips.push({ id: 'dates', label: `Дата: ${from} – ${to}` });
  }
  return chips;
}

function ConfirmDeleteModal({ user, onConfirm, onCancel, loading }) {
  if (!user) return null;
  const isPendingRegistration = user.entry_type === 'pending_registration';
  const isStudentProfile = user.entry_type === 'student_profile';
  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4" onClick={onCancel} role="presentation">
      <div className="bg-card rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-border" onClick={(e) => e.stopPropagation()} role="alertdialog">
        <h3 className="text-base font-bold text-center mb-1">
          {isPendingRegistration
            ? 'Удалить незавершённую регистрацию?'
            : isStudentProfile
              ? 'Удалить ученика без аккаунта?'
              : 'Удалить пользователя?'}
        </h3>
        <p className="text-sm text-muted-foreground text-center mb-6">
          <span className="font-semibold text-foreground">{getUserDisplayName(user)}</span>
          {isPendingRegistration
            ? ' будет удалена из реестра без создания аккаунта.'
            : isStudentProfile
              ? ' будет удалён вместе с операционными связями. История платежей сохранится.'
              : ' будет удалён.'}
        </p>
        <div className="flex gap-3">
          <Button type="button" intent="outline" className="flex-1 min-h-touch" onClick={onCancel} disabled={loading}>Отмена</Button>
          <Button type="button" intent="danger" className="flex-1 min-h-touch" onClick={onConfirm} disabled={loading}>
            {loading ? 'Удаление...' : 'Удалить'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function UserMobileCard({ user, onOpen, onDelete }) {
  const role = displayRole(user);
  const name = getUserDisplayName(user);
  const roleLabel = ROLE_CONFIG[role]?.label || role;
  const statusKey = user?.display_status || user?.account_status || user?.status;
  const statusLabel = ACCOUNT_STATUS_LABEL[statusKey]
    || REGISTRY_STATUS_OPTIONS.find((s) => s.value === statusKey)?.label
    || statusKey
    || '—';
  const balanceLabel = formatLessonBalance(user.lesson_balance);
  const canOpen = user.entry_type !== 'pending_registration';

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <button
        type="button"
        className="w-full text-left p-4 min-h-touch flex items-start gap-3"
        onClick={() => canOpen && onOpen(user)}
        disabled={!canOpen}
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-base font-semibold text-foreground truncate">{name}</p>
          <p className="text-sm text-muted-foreground">
            {roleLabel}
            <span className="mx-1.5 text-border">·</span>
            {statusLabel}
          </p>
          {user.assigned_teacher_name ? (
            <p className="text-sm text-muted-foreground truncate">
              Преподаватель: {user.assigned_teacher_name}
            </p>
          ) : null}
          {balanceLabel ? (
            <p className="text-sm text-muted-foreground">Баланс: {balanceLabel}</p>
          ) : null}
          {user.email ? (
            <p className="text-xs text-muted-foreground/80 truncate">{formatContact(user.email)}</p>
          ) : null}
        </div>
        {canOpen ? (
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground mt-1" aria-hidden />
        ) : null}
      </button>
      <div className="flex items-center justify-end border-t border-border px-2 py-1">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 min-h-touch text-sm text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
          onClick={() => onDelete(user)}
          aria-label={`Удалить ${name}`}
        >
          <MoreVertical className="h-4 w-4" aria-hidden />
          <span>Удалить</span>
        </button>
      </div>
    </div>
  );
}

export default function UserManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseRegistryFilters(searchParams), [searchParams]);
  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebouncedValue(searchInput, 350);

  const [data, setData] = useState({ items: [], total: 0, page: 1, limit: 25, page_count: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [editUser, setEditUser] = useState(null);
  const [createStudentOpen, setCreateStudentOpen] = useState(false);
  const [mergeUser, setMergeUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(() => draftFromFilters(filters));

  const updateFilters = useCallback((patch) => {
    const next = { ...filters, ...patch, page: patch.page ?? 1 };
    setSearchParams(serializeRegistryFilters(next), { replace: true });
  }, [filters, setSearchParams]);

  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      updateFilters({ search: debouncedSearch });
    }
  }, [debouncedSearch, filters.search, updateFilters]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await api.users.registry(buildRegistryQuery(filters));
      setData({
        items: Array.isArray(result.items) ? result.items : [],
        total: result.total ?? 0,
        page: result.page ?? filters.page,
        limit: result.limit ?? filters.limit,
        page_count: result.page_count ?? 0,
      });
    } catch (err) {
      setLoadError(err?.message || 'Не удалось загрузить пользователей');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.teachers.list().then((rows) => setTeachers(Array.isArray(rows) ? rows : [])).catch(() => setTeachers([]));
  }, []);

  const teacherFilterOptions = useMemo(() => [
    { value: 'none', label: 'Без преподавателя' },
    ...teachers.map((t) => ({ value: t.id, label: t.name || t.email || t.id })),
  ], [teachers]);

  const filterChips = useMemo(
    () => buildFilterChips(filters, teacherFilterOptions),
    [filters, teacherFilterOptions],
  );

  const panelFilterCount = filterChips.length;

  const resetAllFilters = () => {
    setSearchInput('');
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const removeChip = (chipId) => {
    if (chipId.startsWith('role:')) {
      const role = chipId.slice(5);
      updateFilters({ roles: filters.roles.filter((r) => r !== role) });
      return;
    }
    if (chipId.startsWith('accountStatus:')) {
      const status = chipId.slice('accountStatus:'.length);
      updateFilters({ accountStatuses: filters.accountStatuses.filter((s) => s !== status) });
      return;
    }
    if (chipId.startsWith('status:')) {
      const status = chipId.slice(7);
      updateFilters({ statuses: filters.statuses.filter((s) => s !== status) });
      return;
    }
    if (chipId === 'teacher') {
      updateFilters({ assignedTeacherId: '' });
      return;
    }
    if (chipId === 'dates') {
      updateFilters({ createdFrom: '', createdTo: '', datePreset: '' });
    }
  };

  const openMobileFilters = () => {
    setDraftFilters(draftFromFilters(filters));
    setMobileFiltersOpen(true);
  };

  const applyMobileFilters = () => {
    updateFilters({ ...draftFilters, page: 1 });
    setMobileFiltersOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    setDeleting(true);
    try {
      const isPendingRegistration = deleteUser.entry_type === 'pending_registration';
      const isStudentProfile = deleteUser.entry_type === 'student_profile';
      const result = isPendingRegistration
        ? await api.users.deletePendingRegistration(deleteUser.id)
        : isStudentProfile
          ? await api.students.delete(deleteUser.id)
          : await api.users.delete(deleteUser.id);
      if (!isPendingRegistration && !isStudentProfile) {
        showOrphanStudentsNotice(result, toast);
      }
      setDeleteUser(null);
      await load();
      toast({
        title: isPendingRegistration
          ? 'Регистрация удалена'
          : isStudentProfile
            ? 'Ученик удалён'
            : 'Пользователь удалён',
      });
    } catch (err) {
      toast({
        title: 'Не удалось удалить пользователя',
        description: userFacingError(err, 'Попробуйте ещё раз'),
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const rangeFrom = data.total === 0 ? 0 : (data.page - 1) * data.limit + 1;
  const rangeTo = Math.min(data.page * data.limit, data.total);
  const filtersActive = hasActiveFilters(filters);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full min-w-0">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Пользователи</h1>
          <p className="text-sm text-muted-foreground mt-1">Единый реестр аккаунтов системы</p>
          {loadError && <p className="text-sm text-red-600 mt-2">{loadError}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            intent="primary"
            size="sm"
            className="gap-1.5"
            onClick={() => setCreateStudentOpen(true)}
            data-testid="admin-create-student"
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            Создать ученика
          </Button>
          {filtersActive && (
            <Button type="button" intent="outline" size="sm" className="hidden lg:inline-flex" onClick={resetAllFilters}>
              Сбросить фильтры
            </Button>
          )}
        </div>
      </div>

      {/* Mobile: search → filters → chips */}
      <div className="lg:hidden mb-4">
        <MobileFilterToolbar
          searchValue={searchInput}
          onSearchChange={(e) => setSearchInput(e.target.value)}
          searchPlaceholder="Поиск пользователей…"
          searchAriaLabel="Поиск пользователей"
          activeFilterCount={panelFilterCount}
          onOpenFilters={openMobileFilters}
          chips={filterChips}
          onRemoveChip={removeChip}
          onClearAll={panelFilterCount > 0 ? resetAllFilters : undefined}
        />
      </div>

      {/* Desktop: search only; filters stay in table headers */}
      <div className="hidden lg:flex flex-col sm:flex-row gap-3 mb-4">
        <SearchField
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Поиск пользователей..."
          className="flex-1 max-w-full sm:max-w-md"
          aria-label="Поиск пользователей"
        />
      </div>

      {filtersActive && (
        <div className="hidden lg:block mb-4">
          <MobileFilterChips
            chips={filterChips}
            onRemove={removeChip}
            onClearAll={resetAllFilters}
          />
        </div>
      )}

      {loading && data.items.length === 0 ? (
        <PageLoading label="Загрузка пользователей" />
      ) : data.items.length === 0 ? (
        <EmptyState preset="generic" title="Пользователи не найдены" icon={Users} />
      ) : (
        <>
          <div className="lg:hidden space-y-3">
            {data.items.map((user) => (
              <UserMobileCard
                key={user.id}
                user={user}
                onOpen={setEditUser}
                onDelete={setDeleteUser}
              />
            ))}
          </div>

          <div className="hidden lg:block bg-card rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3">
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => updateFilters(toggleSort(filters.sort, filters.sortDir, 'name'))}>
                        Пользователь <SortIndicator active={filters.sort === 'name'} dir={filters.sortDir} />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3">Email</th>
                    <th className="text-left px-4 py-3">
                      <ExcelColumnFilter label="Роль" options={REGISTRY_ROLE_OPTIONS} value={filters.roles} active={filters.roles.length > 0} onApply={(roles) => updateFilters({ roles })} />
                    </th>
                    <th className="text-left px-4 py-3">
                      <ExcelColumnFilter label="Статус аккаунта" options={ACCOUNT_STATUS_OPTIONS} value={filters.accountStatuses} active={filters.accountStatuses.length > 0} onApply={(accountStatuses) => updateFilters({ accountStatuses })} />
                    </th>
                    <th className="text-left px-4 py-3">
                      <ExcelColumnFilter label="Статус" options={REGISTRY_STATUS_OPTIONS} value={filters.statuses} active={filters.statuses.length > 0} onApply={(statuses) => updateFilters({ statuses })} />
                    </th>
                    <th className="text-left px-4 py-3 hidden xl:table-cell">
                      <ExcelColumnFilter label="Преподаватель" options={teacherFilterOptions} value={filters.assignedTeacherId ? [filters.assignedTeacherId] : []} active={Boolean(filters.assignedTeacherId)} onApply={(values) => updateFilters({ assignedTeacherId: values[0] ?? '' })} />
                    </th>
                    <th className="text-left px-4 py-3">
                      <button type="button" className="inline-flex items-center gap-1 mr-2" onClick={() => updateFilters(toggleSort(filters.sort, filters.sortDir, 'created_date'))}>
                        Дата регистрации <SortIndicator active={filters.sort === 'created_date'} dir={filters.sortDir} />
                      </button>
                      <DateRangeColumnFilter value={{ from: filters.createdFrom, to: filters.createdTo, preset: filters.datePreset }} active={Boolean(filters.createdFrom || filters.createdTo)} onApply={({ from, to, preset }) => updateFilters({ createdFrom: from, createdTo: to, datePreset: preset })} />
                    </th>
                    <th className="px-4 py-3 w-16"> </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((user) => {
                    const role = displayRole(user);
                    const name = getUserDisplayName(user);
                    const registryStatusLabel = REGISTRY_STATUS_OPTIONS.find((s) => s.value === user.status)?.label
                      || user.status
                      || '—';
                    return (
                      <tr
                        key={user.id}
                        className="border-b border-border last:border-0 hover:bg-muted/40 cursor-pointer"
                        onClick={() => {
                          if (user.entry_type === 'pending_registration') return;
                          setEditUser(user);
                        }}
                      >
                        <td className="px-4 py-3 font-medium">{name}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{formatContact(user.email)}</td>
                        <td className="px-4 py-3"><RoleBadge user={user} role={role} /></td>
                        <td className="px-4 py-3"><StatusBadge user={user} /></td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{registryStatusLabel}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground hidden xl:table-cell">
                          {user.assigned_teacher_name || '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {user.created_date ? new Date(user.created_date).toLocaleDateString('ru-RU') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="p-2 text-muted-foreground hover:text-red-500 rounded-lg"
                            onClick={(e) => { e.stopPropagation(); setDeleteUser(user); }}
                            aria-label="Удалить"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {data.total > 0 ? `${rangeFrom}–${rangeTo} из ${data.total}` : '0 пользователей'}
          {loading && <Loader2 className="inline w-4 h-4 ml-2 animate-spin" />}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-lg border bg-background px-3 py-2 text-sm min-h-touch"
            value={filters.limit}
            onChange={(e) => updateFilters({ limit: Number(e.target.value), page: 1 })}
            aria-label="Строк на странице"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n} / стр.</option>
            ))}
          </select>
          <Button type="button" intent="outline" className="min-h-touch" disabled={filters.page <= 1} onClick={() => updateFilters({ page: filters.page - 1 })}>
            Назад
          </Button>
          <span className="text-sm text-muted-foreground px-1">{filters.page} / {Math.max(data.page_count, 1)}</span>
          <Button type="button" intent="outline" className="min-h-touch" disabled={filters.page >= data.page_count} onClick={() => updateFilters({ page: filters.page + 1 })}>
            Вперёд
          </Button>
        </div>
      </div>

      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto flex flex-col gap-0 p-0">
          <SheetHeader className="px-4 pt-4 pb-2 border-b border-border shrink-0">
            <SheetTitle>Фильтры</SheetTitle>
          </SheetHeader>
          <div className="space-y-5 px-4 py-4 overflow-y-auto flex-1 min-h-0">
            <MobileMultiSelect
              label="Роль"
              options={REGISTRY_ROLE_OPTIONS}
              value={draftFilters.roles}
              onChange={(roles) => setDraftFilters((d) => ({ ...d, roles }))}
            />
            <MobileMultiSelect
              label="Статус аккаунта"
              options={ACCOUNT_STATUS_OPTIONS}
              value={draftFilters.accountStatuses}
              onChange={(accountStatuses) => setDraftFilters((d) => ({ ...d, accountStatuses }))}
            />
            <MobileMultiSelect
              label="Статус"
              options={REGISTRY_STATUS_OPTIONS}
              value={draftFilters.statuses}
              onChange={(statuses) => setDraftFilters((d) => ({ ...d, statuses }))}
            />
            <MobileSelectField
              label="Преподаватель ученика"
              value={draftFilters.assignedTeacherId}
              onChange={(assignedTeacherId) => setDraftFilters((d) => ({ ...d, assignedTeacherId }))}
              options={teacherFilterOptions}
              emptyLabel="Все преподаватели"
            />
            <div className="grid grid-cols-1 gap-3">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-foreground">Дата регистрации с</span>
                <input
                  type="date"
                  className="w-full min-h-touch rounded-xl border border-border bg-background px-3 text-base"
                  value={draftFilters.createdFrom ? draftFilters.createdFrom.slice(0, 10) : ''}
                  onChange={(e) => setDraftFilters((d) => ({
                    ...d,
                    createdFrom: e.target.value ? `${e.target.value}T00:00:00.000Z` : '',
                    datePreset: '',
                  }))}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-foreground">Дата регистрации по</span>
                <input
                  type="date"
                  className="w-full min-h-touch rounded-xl border border-border bg-background px-3 text-base"
                  value={draftFilters.createdTo ? draftFilters.createdTo.slice(0, 10) : ''}
                  onChange={(e) => setDraftFilters((d) => ({
                    ...d,
                    createdTo: e.target.value ? `${e.target.value}T23:59:59.999Z` : '',
                    datePreset: '',
                  }))}
                />
              </label>
            </div>
          </div>
          <SheetFooter className="px-4 py-3 border-t border-border flex flex-row gap-2 shrink-0 safe-pb">
            <Button
              type="button"
              intent="outline"
              className="flex-1 min-h-touch"
              onClick={() => {
                setDraftFilters({
                  roles: [],
                  accountStatuses: [],
                  statuses: [],
                  assignedTeacherId: '',
                  createdFrom: '',
                  createdTo: '',
                  datePreset: '',
                });
              }}
            >
              Сбросить
            </Button>
            <Button type="button" className="flex-1 min-h-touch" onClick={applyMobileFilters}>
              Применить
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <UserEditDialog
        user={editUser}
        open={Boolean(editUser)}
        onOpenChange={(open) => { if (!open) setEditUser(null); }}
        onSaved={load}
        onMerge={() => {
          setMergeUser(editUser);
          setEditUser(null);
        }}
      />

      <StudentFormDialog
        open={createStudentOpen}
        onOpenChange={setCreateStudentOpen}
        student={null}
        onSave={load}
      />

      <StudentMergeDialog
        user={mergeUser}
        open={Boolean(mergeUser)}
        onOpenChange={(open) => { if (!open) setMergeUser(null); }}
        onMerged={load}
      />

      {deleteUser && (
        <ConfirmDeleteModal
          user={deleteUser}
          onConfirm={handleDelete}
          onCancel={() => setDeleteUser(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}
