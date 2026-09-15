import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Users,
  Wallet,
  AlertTriangle,
  TrendingUp,
  BookOpen,
} from 'lucide-react';
import { api } from '@/api';
import { createPageUrl } from '@/utils';
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
import PageHeader from '@/components/responsive/PageHeader';
import MobileFilterToolbar from '@/components/responsive/MobileFilterToolbar';
import MobileFilterChips from '@/components/responsive/MobileFilterChips';
import { MobileSelectField } from '@/components/responsive/MobileFilterFields';
import LessonBalanceDisplay from '@/components/students/LessonBalanceDisplay';
import { formatBYN } from '@/lib/formatters';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { userFacingError } from '@/lib/userFacingError';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 25;

const FILTER_PRESETS = [
  { id: 'all', label: 'Все ученики' },
  { id: 'debtors', label: 'Только должники' },
  { id: 'positive', label: 'С остатком / переплатой' },
];

const SORT_OPTIONS = [
  { id: 'name', label: 'ФИО' },
  { id: 'debt', label: 'Долг' },
  { id: 'overpayment', label: 'Переплата' },
  { id: 'conducted', label: 'Проведено' },
  { id: 'paid', label: 'Оплачено' },
  { id: 'lesson_balance', label: 'Остаток занятий' },
];

function moneyPositionLabel(row) {
  if (row.money_position == null) return '—';
  if (Number(row.debt_amount) > 0) {
    return `Должен: ${formatBYN(row.debt_amount)}`;
  }
  if (Number(row.overpayment_amount) > 0) {
    return `Переплата: ${formatBYN(row.overpayment_amount)}`;
  }
  return formatBYN(0);
}

function moneyPositionClass(row) {
  if (Number(row.debt_amount) > 0) return 'text-red-600 dark:text-red-400 font-semibold';
  if (Number(row.overpayment_amount) > 0) return 'text-emerald-700 dark:text-emerald-400 font-semibold';
  return 'text-muted-foreground';
}

function SummaryCard({ icon: Icon, label, value, tone = 'default' }) {
  const toneClass =
    tone === 'danger'
      ? 'border-red-200 bg-red-50/80 dark:border-red-900 dark:bg-red-950/30'
      : tone === 'ok'
        ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/30'
        : 'border-border bg-card';
  return (
    <div className={cn('rounded-2xl border p-4 shadow-sm', toneClass)}>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 text-xl font-bold text-foreground tabular-nums">{value}</p>
    </div>
  );
}

function SortHeader({ label, sortKey, sort, sortDir, onSort }) {
  const active = sort === sortKey;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 hover:text-foreground"
      onClick={() => onSort(sortKey)}
    >
      {label}
      {active ? (sortDir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />) : null}
    </button>
  );
}

export default function Balance() {
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const [preset, setPreset] = useState('all');
  const [teacherId, setTeacherId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [sort, setSort] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);

  const [teachers, setTeachers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [data, setData] = useState({
    items: [],
    total: 0,
    page: 1,
    limit: PAGE_SIZE,
    page_count: 0,
    summary: {
      students_total: 0,
      debtors_count: 0,
      total_debt: 0,
      total_overpayment: 0,
      conducted_lessons_total: 0,
    },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [draftTeacherId, setDraftTeacherId] = useState('');
  const [draftGroupId, setDraftGroupId] = useState('');
  const [draftPreset, setDraftPreset] = useState('all');
  const [draftSort, setDraftSort] = useState('name');
  const [adjustBalance, setAdjustBalance] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [teacherRows, groupRows] = await Promise.all([
          api.teachers.listActive(),
          api.groups.list(),
        ]);
        if (cancelled) return;
        setTeachers(Array.isArray(teacherRows) ? teacherRows : []);
        setGroups(Array.isArray(groupRows) ? groupRows : []);
      } catch {
        if (!cancelled) {
          setTeachers([]);
          setGroups([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const queryParams = useMemo(() => ({
    search: debouncedSearch.trim() || undefined,
    teacherId: teacherId || undefined,
    groupId: groupId || undefined,
    debtorsOnly: preset === 'debtors' || undefined,
    positiveBalanceOnly: preset === 'positive' || undefined,
    sort,
    sortDir,
    page,
    limit: PAGE_SIZE,
  }), [debouncedSearch, teacherId, groupId, preset, sort, sortDir, page]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.balances.list(queryParams);
      setData({
        items: Array.isArray(result.items) ? result.items : [],
        total: result.total ?? 0,
        page: result.page ?? page,
        limit: result.limit ?? PAGE_SIZE,
        page_count: result.page_count ?? 0,
        summary: result.summary || {
          students_total: 0,
          debtors_count: 0,
          total_debt: 0,
          total_overpayment: 0,
          conducted_lessons_total: 0,
        },
      });
    } catch (err) {
      setError(userFacingError(err, 'Не удалось загрузить баланс'));
      setData((prev) => ({ ...prev, items: [], total: 0, page_count: 0 }));
    } finally {
      setLoading(false);
    }
  }, [queryParams, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, teacherId, groupId, preset, sort, sortDir]);

  const openDetail = async (studentId) => {
    setDetailId(studentId);
    setDetail(null);
    setDetailLoading(true);
    setAdjustBalance('');
    try {
      const result = await api.balances.detail(studentId);
      setDetail(result);
      setAdjustBalance(String(result?.finance?.lesson_balance ?? ''));
    } catch (err) {
      setDetail(null);
      setError(userFacingError(err, 'Не удалось загрузить карточку ученика'));
    } finally {
      setDetailLoading(false);
    }
  };

  const submitLessonAdjust = async () => {
    if (!detailId) return;
    const newBalance = Number.parseInt(String(adjustBalance), 10);
    if (!Number.isInteger(newBalance)) {
      setError('Остаток занятий должен быть целым числом');
      return;
    }
    setAdjusting(true);
    setError('');
    try {
      const result = await api.balances.adjustLessons(detailId, {
        newBalance,
      });
      setDetail(result);
      setAdjustBalance(String(result?.finance?.lesson_balance ?? newBalance));
      await load();
    } catch (err) {
      setError(userFacingError(err, 'Не удалось сохранить корректировку'));
    } finally {
      setAdjusting(false);
    }
  };

  const onSort = (key) => {
    if (sort === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  const teacherOptions = useMemo(
    () => teachers.map((t) => ({ value: t.id, label: t.name || t.email || t.id })),
    [teachers],
  );
  const groupOptions = useMemo(
    () => groups.map((g) => ({ value: g.id, label: g.name || g.id })),
    [groups],
  );

  const filterChips = useMemo(() => {
    const chips = [];
    if (preset !== 'all') {
      const label = FILTER_PRESETS.find((p) => p.id === preset)?.label || preset;
      chips.push({ id: 'preset', label });
    }
    if (teacherId) {
      const label = teacherOptions.find((t) => t.value === teacherId)?.label || teacherId;
      chips.push({ id: 'teacher', label: `Преподаватель: ${label}` });
    }
    if (groupId) {
      const label = groupOptions.find((g) => g.value === groupId)?.label || groupId;
      chips.push({ id: 'group', label: `Группа: ${label}` });
    }
    if (sort !== 'name') {
      const label = SORT_OPTIONS.find((s) => s.id === sort)?.label || sort;
      chips.push({ id: 'sort', label: `Сортировка: ${label}` });
    }
    return chips;
  }, [preset, teacherId, groupId, sort, teacherOptions, groupOptions]);

  const removeChip = (chipId) => {
    if (chipId === 'preset') setPreset('all');
    if (chipId === 'teacher') setTeacherId('');
    if (chipId === 'group') setGroupId('');
    if (chipId === 'sort') {
      setSort('name');
      setSortDir('asc');
    }
  };

  const resetFilters = () => {
    setSearchInput('');
    setPreset('all');
    setTeacherId('');
    setGroupId('');
    setSort('name');
    setSortDir('asc');
  };

  const openMobileFilters = () => {
    setDraftTeacherId(teacherId);
    setDraftGroupId(groupId);
    setDraftPreset(preset);
    setDraftSort(sort);
    setMobileFiltersOpen(true);
  };

  const applyMobileFilters = () => {
    setTeacherId(draftTeacherId);
    setGroupId(draftGroupId);
    setPreset(draftPreset);
    if (draftSort !== sort) {
      setSort(draftSort);
      setSortDir(draftSort === 'name' ? 'asc' : 'desc');
    }
    setMobileFiltersOpen(false);
  };

  const summary = data.summary;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Баланс"
        description="Оплаты, проведённые занятия и остаток по каждому ученику школы"
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCard icon={Users} label="Всего учеников" value={summary.students_total} />
        <SummaryCard icon={AlertTriangle} label="Должников" value={summary.debtors_count} tone="danger" />
        <SummaryCard icon={Wallet} label="Общая задолженность" value={formatBYN(summary.total_debt)} tone="danger" />
        <SummaryCard icon={TrendingUp} label="Общая переплата" value={formatBYN(summary.total_overpayment)} tone="ok" />
        <SummaryCard icon={BookOpen} label="Проведено занятий" value={summary.conducted_lessons_total} />
      </div>

      <div className="lg:hidden space-y-3">
        <MobileFilterToolbar
          searchValue={searchInput}
          onSearchChange={(e) => setSearchInput(e.target.value)}
          searchPlaceholder="Поиск по ФИО, email, телефону…"
          searchAriaLabel="Поиск учеников"
          activeFilterCount={filterChips.length}
          onOpenFilters={openMobileFilters}
          chips={filterChips}
          onRemoveChip={removeChip}
          onClearAll={filterChips.length > 0 || searchInput ? resetFilters : undefined}
        />
      </div>

      <div className="hidden lg:block rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="flex-1">
            <SearchField
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Поиск по ФИО, email, телефону…"
            />
          </div>
          <select
            className="rounded-lg border bg-background px-3 py-2 text-sm min-w-[12rem]"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
          >
            <option value="">Все преподаватели</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.name || t.email || t.id}</option>
            ))}
          </select>
          <select
            className="rounded-lg border bg-background px-3 py-2 text-sm min-w-[12rem]"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            <option value="">Все группы</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name || g.id}</option>
            ))}
          </select>
          <select
            className="rounded-lg border bg-background px-3 py-2 text-sm min-w-[10rem]"
            value={sort}
            onChange={(e) => onSort(e.target.value)}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>Сортировка: {opt.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTER_PRESETS.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              intent={preset === item.id ? 'primary' : 'outline'}
              onClick={() => setPreset(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        {filterChips.length > 0 ? (
          <MobileFilterChips chips={filterChips} onRemove={removeChip} onClearAll={resetFilters} />
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <PageLoading label="Загрузка баланса…" />
      ) : data.items.length === 0 ? (
        <EmptyState
          title="Ученики не найдены"
          description="Измените фильтры или поисковый запрос"
        />
      ) : (
        <>
          <div className="hidden lg:block overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">
                    <SortHeader label="Ученик" sortKey="name" sort={sort} sortDir={sortDir} onSort={onSort} />
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">
                    <SortHeader label="Проведено" sortKey="conducted" sort={sort} sortDir={sortDir} onSort={onSort} />
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">
                    <SortHeader label="Оплачено" sortKey="paid" sort={sort} sortDir={sortDir} onSort={onSort} />
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">Стоимость проведённых</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    <SortHeader label="Должен / переплата" sortKey="debt" sort={sort} sortDir={sortDir} onSort={onSort} />
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">
                    <SortHeader label="Остаток занятий" sortKey="lesson_balance" sort={sort} sortDir={sortDir} onSort={onSort} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr
                    key={row.student_id}
                    className="border-t border-border hover:bg-muted/40 cursor-pointer"
                    onClick={() => openDetail(row.student_id)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{row.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[row.phone, row.email].filter(Boolean).join(' · ') || '—'}
                      </div>
                      {row.assigned_teacher_name ? (
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Преп.: {row.assigned_teacher_name}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.conducted_lessons}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatBYN(row.paid_amount)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.cost_conducted == null ? '—' : formatBYN(row.cost_conducted)}
                    </td>
                    <td className={cn('px-4 py-3 text-right tabular-nums', moneyPositionClass(row))}>
                      {moneyPositionLabel(row)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <LessonBalanceDisplay row={{ lesson_balance: row.lesson_balance }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden space-y-3">
            {data.items.map((row) => (
              <button
                key={row.student_id}
                type="button"
                onClick={() => openDetail(row.student_id)}
                className="w-full text-left rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm min-h-touch"
              >
                <div className="flex items-start justify-between gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{row.name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {row.assigned_teacher_name
                        ? `Преп.: ${row.assigned_teacher_name}`
                        : ([row.phone, row.email].filter(Boolean).join(' · ') || '—')}
                    </p>
                  </div>
                  <LessonBalanceDisplay row={{ lesson_balance: row.lesson_balance }} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Проведено: <span className="font-semibold tabular-nums">{row.conducted_lessons}</span></div>
                  <div>Оплачено: <span className="font-semibold tabular-nums">{formatBYN(row.paid_amount)}</span></div>
                  <div className="col-span-2">
                    <span className={moneyPositionClass(row)}>{moneyPositionLabel(row)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {data.page_count > 1 ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Страница {data.page} из {data.page_count} · {data.total} учеников
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  intent="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Назад
                </Button>
                <Button
                  type="button"
                  intent="outline"
                  size="sm"
                  disabled={page >= data.page_count}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Далее
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto flex flex-col gap-0 p-0">
          <SheetHeader className="px-4 pt-4 pb-2 border-b border-border shrink-0">
            <SheetTitle>Фильтры</SheetTitle>
          </SheetHeader>
          <div className="space-y-5 px-4 py-4 overflow-y-auto flex-1 min-h-0">
            <MobileSelectField
              label="Выборка"
              value={draftPreset}
              onChange={setDraftPreset}
              options={FILTER_PRESETS.map((p) => ({
                value: p.id,
                label: p.label,
              }))}
              hideEmpty
            />
            <MobileSelectField
              label="Преподаватель"
              value={draftTeacherId}
              onChange={setDraftTeacherId}
              options={teacherOptions}
              emptyLabel="Все преподаватели"
            />
            <MobileSelectField
              label="Группа"
              value={draftGroupId}
              onChange={setDraftGroupId}
              options={groupOptions}
              emptyLabel="Все группы"
            />
            <MobileSelectField
              label="Сортировка"
              value={draftSort}
              onChange={setDraftSort}
              options={SORT_OPTIONS.map((o) => ({ value: o.id, label: o.label }))}
              hideEmpty
            />
          </div>
          <SheetFooter className="px-4 py-3 border-t border-border flex flex-row gap-2 shrink-0 safe-pb">
            <Button
              type="button"
              intent="outline"
              className="flex-1 min-h-touch"
              onClick={() => {
                setDraftTeacherId('');
                setDraftGroupId('');
                setDraftPreset('all');
                setDraftSort('name');
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

      <Sheet open={Boolean(detailId)} onOpenChange={(open) => { if (!open) { setDetailId(null); setDetail(null); } }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {detail?.student?.name || 'Карточка баланса'}
            </SheetTitle>
          </SheetHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Загрузка…
            </div>
          ) : detail ? (
            <div className="mt-4 space-y-6 px-1 pb-8">
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`${createPageUrl('StudentDetail')}?id=${detail.student.student_id}`}
                  className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                >
                  Открыть карточку ученика
                </Link>
              </div>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Финансы</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Всего оплачено</p>
                    <p className="font-semibold">{formatBYN(detail.finance.paid_amount)}</p>
                  </div>
                  <div className="rounded-xl bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Стоимость проведённых</p>
                    <p className="font-semibold">
                      {detail.finance.cost_conducted == null
                        ? '—'
                        : formatBYN(detail.finance.cost_conducted)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Долг</p>
                    <p className="font-semibold text-red-600">{formatBYN(detail.finance.debt_amount)}</p>
                  </div>
                  <div className="rounded-xl bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Переплата</p>
                    <p className="font-semibold text-emerald-700">{formatBYN(detail.finance.overpayment_amount)}</p>
                  </div>
                  <div className="rounded-xl bg-muted p-3 col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Остаток занятий</p>
                    <LessonBalanceDisplay row={{ lesson_balance: detail.finance.lesson_balance }} />
                    {detail.finance.unit_price != null ? (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Цена занятия из оплат: {formatBYN(detail.finance.unit_price)}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Нет оплат с начислением занятий — денежная стоимость не рассчитана
                      </p>
                    )}
                    {Number(detail.finance.historical_lessons_credit) !== 0 ? (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Исторический кредит занятий (перенос в CRM):{' '}
                        <b>{detail.finance.historical_lessons_credit}</b>
                        {' '}· учитывается в денежном балансе без фиктивных оплат
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Корректировка остатка занятий</h3>
                <p className="text-xs text-muted-foreground">
                  Меняет только остаток занятий и пишет audit. Не создаёт оплату и не создаёт занятие.
                </p>
                <label className="block text-sm space-y-1">
                  <span className="text-muted-foreground">Новый остаток</span>
                  <input
                    type="number"
                    step="1"
                    className="w-full min-h-touch rounded-xl border border-border bg-background px-3 text-base"
                    value={adjustBalance}
                    onChange={(e) => setAdjustBalance(e.target.value)}
                    data-testid="balance-adjust-new-value"
                  />
                </label>
                <Button
                  type="button"
                  intent="outline"
                  className="w-full min-h-touch"
                  disabled={adjusting}
                  onClick={submitLessonAdjust}
                  data-testid="balance-adjust-save"
                >
                  {adjusting ? 'Сохранение…' : 'Сохранить корректировку'}
                </Button>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Занятия</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl bg-muted p-3">Проведено: <b>{detail.lessons.conducted}</b></div>
                  <div className="rounded-xl bg-muted p-3">Запланировано: <b>{detail.lessons.planned}</b></div>
                  <div className="rounded-xl bg-muted p-3">Отменено: <b>{detail.lessons.cancelled}</b></div>
                  <div className="rounded-xl bg-muted p-3">Предстоящие: <b>{detail.lessons.upcoming}</b></div>
                  <div className="rounded-xl bg-muted p-3">Индивидуальные: <b>{detail.lessons.individual_conducted}</b></div>
                  <div className="rounded-xl bg-muted p-3">Групповые: <b>{detail.lessons.group_conducted}</b></div>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">История операций</h3>
                {detail.history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Операций пока нет</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.history.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-xl border border-border px-3 py-2 text-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">
                              {item.date} — {item.label}
                            </p>
                            <p className="text-xs text-muted-foreground">{item.comment || '—'}</p>
                          </div>
                          <span
                            className={cn(
                              'tabular-nums font-semibold shrink-0',
                              item.amount == null
                                ? 'text-muted-foreground'
                                : item.amount >= 0
                                  ? 'text-emerald-700'
                                  : 'text-red-600',
                            )}
                          >
                            {item.amount == null
                              ? '—'
                              : `${item.amount >= 0 ? '+' : ''}${formatBYN(item.amount)}`}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Нет данных</p>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
