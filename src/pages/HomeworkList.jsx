import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ClipboardCheck,
  History,
  Loader2,
  MoreVertical,
  Plus,
  Send,
  Share2,
  Trash2,
  Users,
} from 'lucide-react';
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState, IconButton } from '@/design-system';
import { toast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import { userFacingError } from '@/lib/userFacingError';
import { OfflineSnapshotBanner } from '@/components/pwa/OfflineSnapshotBanner';
import { OFFLINE_RESOURCES, readWithOfflineFallback } from '@/lib/offline';
import {
  filterHomeworkAssignments,
} from '@/lib/teacher-work-history';
import HomeworkGrantAccessDialog from '@/components/homework/HomeworkGrantAccessDialog';
import HomeworkAccessManageDialog from '@/components/homework/HomeworkAccessManageDialog';

const HW_STATUS_LABEL = {
  draft: 'Черновик',
  published: 'Опубликовано',
  archived: 'В архиве',
};

const ACTIVITY_LABEL = {
  test: 'Тест',
  reading: 'Чтение',
  listening: 'Аудирование',
  speaking: 'Говорение',
  writing: 'Письмо',
};

const ASSIGNMENT_STATUS_LABEL = {
  assigned: 'Назначено',
  started: 'Выполняется',
  in_progress: 'Выполняется',
  submitted: 'На проверке',
  checked: 'Проверено',
  reviewed: 'Проверено',
  expired: 'Просрочено',
  overdue: 'Просрочено',
  cancelled: 'Отменено',
  needs_revision: 'На доработке',
};

const TABS = [
  { id: 'created', label: 'Шаблоны', shortLabel: 'Шаблоны', icon: BookOpen },
  { id: 'review', label: 'На проверке', shortLabel: 'Проверка', icon: ClipboardCheck },
  { id: 'history', label: 'Выполненные', shortLabel: 'Выполненные', icon: History },
  { id: 'assigned', label: 'Все', shortLabel: 'Все', icon: Users },
];

const LIBRARY_SEGMENTS = [
  { id: 'mine', label: 'Мои' },
  { id: 'shared', label: 'Доступные мне' },
  { id: 'all', label: 'Все' },
];

const fieldClass =
  'h-11 min-h-11 w-full rounded-md border border-input bg-background px-3 text-base md:h-9 md:min-h-9 md:text-sm';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ru-RU');
}

function formatResult(row) {
  if (row.result_percent != null) return `${row.result_percent}%`;
  if (row.review_result) return row.review_result;
  return '—';
}

function isSharedHomework(hw) {
  return hw?.access_role === 'shared' || hw?.is_shared === true;
}

function authorLabel(hw) {
  if (isSharedHomework(hw)) {
    const name = hw.owner_name || 'коллега';
    return `Автор: ${name} · Доступ предоставлен вам`;
  }
  if (hw.owner_name) return `Автор: ${hw.owner_name}`;
  return 'Автор: Я';
}

export default function HomeworkList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState('created');
  const [librarySegment, setLibrarySegment] = useState('mine');
  const [rows, setRows] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantHomeworkIds, setGrantHomeworkIds] = useState([]);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageTarget, setManageTarget] = useState(null);
  const [offlineMeta, setOfflineMeta] = useState({ fromCache: false, updatedAt: null, missing: false });

  const load = async () => {
    setLoading(true);
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      const result = await readWithOfflineFallback({
        userId: user.id,
        role: user.role || 'teacher',
        resource: OFFLINE_RESOURCES.HOMEWORK,
        resourceKey: 'list',
        fetcher: async () => {
          const [hw, asg] = await Promise.all([
            api.homework.list(),
            api.homework.listAssignments(),
          ]);
          return {
            rows: Array.isArray(hw) ? hw : [],
            assignments: Array.isArray(asg) ? asg : [],
          };
        },
      });
      setOfflineMeta({
        fromCache: result.fromCache,
        updatedAt: result.updatedAt,
        missing: result.missing,
      });
      setRows(result.data?.rows || []);
      setAssignments(result.data?.assignments || []);
      setSelectedIds([]);
      if (result.missing) {
        toast({
          title: 'Домашние задания недоступны без подключения',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Не удалось загрузить задания',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) void load();
  }, [user?.id]);

  const authorOptions = useMemo(
    () => [...new Set(rows.map((r) => r.owner_name).filter(Boolean))],
    [rows],
  );

  const visibleRows = rows.filter((hw) => {
    if (statusFilter && hw.status !== statusFilter) return false;
    if (authorFilter && hw.owner_name !== authorFilter) return false;
    if (!isAdmin) {
      if (librarySegment === 'mine' && isSharedHomework(hw)) return false;
      if (librarySegment === 'shared' && !isSharedHomework(hw)) return false;
    }
    return true;
  });

  const ownedSelectableIds = useMemo(
    () => visibleRows.filter((hw) => !isSharedHomework(hw)).map((hw) => hw.id),
    [visibleRows],
  );

  const reviewRows = useMemo(
    () => filterHomeworkAssignments(assignments, 'review'),
    [assignments],
  );

  const historyRows = useMemo(
    () => filterHomeworkAssignments(assignments, 'history'),
    [assignments],
  );

  const grantTitles = useMemo(
    () =>
      rows
        .filter((hw) => grantHomeworkIds.includes(hw.id))
        .map((hw) => hw.title)
        .filter(Boolean),
    [rows, grantHomeworkIds],
  );

  const handleDelete = async (row) => {
    if (isSharedHomework(row)) return;
    const confirmed = window.confirm(`Удалить домашнее задание «${row.title}»?`);
    if (!confirmed) return;
    setDeletingId(row.id);
    try {
      await api.homework.delete(row.id);
      toast({ title: 'Задание удалено' });
      await load();
    } catch (err) {
      toast({
        title: 'Не удалось удалить',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const openAssignment = (row) => {
    navigate(
      `${createPageUrl('HomeworkResults')}?homeworkId=${encodeURIComponent(row.homework_id)}&assignmentId=${encodeURIComponent(row.id)}`,
    );
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleSelectAllOwned = () => {
    if (selectedIds.length === ownedSelectableIds.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(ownedSelectableIds);
  };

  const openGrantFor = (ids) => {
    setGrantHomeworkIds(ids);
    setGrantOpen(true);
  };

  const openManageFor = (hw) => {
    setManageTarget(hw);
    setManageOpen(true);
  };

  const renderActions = (hw, { compact = false } = {}) => {
    const shared = isSharedHomework(hw);
    const goEdit = () =>
      navigate(`${createPageUrl('HomeworkEditor')}?id=${hw.id}`);
    const goAssign = () =>
      navigate(`${createPageUrl('HomeworkAssignment')}?homeworkId=${hw.id}`);
    const goResults = () =>
      navigate(`${createPageUrl('HomeworkResults')}?homeworkId=${hw.id}`);

    if (compact) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton
              label="Действия"
              className="min-h-11 min-w-11 shrink-0"
              data-testid={`homework-actions-${hw.id}`}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-5 w-5" />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuItem
              onSelect={goEdit}
              data-testid={`homework-action-edit-${hw.id}`}
            >
              {shared ? 'Открыть' : 'Изменить'}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={goAssign}>Назначить</DropdownMenuItem>
            <DropdownMenuItem onSelect={goResults}>Результаты</DropdownMenuItem>
            {!shared ? (
              <>
                <DropdownMenuItem onSelect={() => openGrantFor([hw.id])}>
                  Доступ
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openManageFor(hw)}>
                  Управление доступом
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={deletingId === hw.id}
                  onSelect={() => handleDelete(hw)}
                >
                  Удалить
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return (
      <div className="flex flex-wrap gap-2 justify-end">
        {!shared && (
          <Button variant="outline" size="sm" onClick={goEdit}>
            Изменить
          </Button>
        )}
        {shared && (
          <Button
            variant="outline"
            size="sm"
            onClick={goEdit}
            data-testid={`homework-open-shared-${hw.id}`}
          >
            Открыть
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={goAssign}>
          <Send className="h-3.5 w-3.5 mr-1" />
          Назначить
        </Button>
        <Button variant="outline" size="sm" onClick={goResults}>
          Результаты
        </Button>
        {!shared && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openGrantFor([hw.id])}
              data-testid={`homework-grant-${hw.id}`}
            >
              <Share2 className="h-3.5 w-3.5 mr-1" />
              Доступ
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openManageFor(hw)}
              data-testid={`homework-manage-access-${hw.id}`}
            >
              Управление доступом
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={deletingId === hw.id}
              onClick={() => handleDelete(hw)}
            >
              {deletingId === hw.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mr-1" />
              )}
              Удалить
            </Button>
          </>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div
      className="p-3 sm:p-6 lg:p-8 w-full max-w-6xl mx-auto space-y-4 sm:space-y-6 min-w-0 overflow-x-hidden"
      data-testid="homework-list"
    >
      <OfflineSnapshotBanner
        fromCache={offlineMeta.fromCache}
        updatedAt={offlineMeta.updatedAt}
        missing={offlineMeta.missing}
        emptyLabel="Домашние задания пока недоступны без подключения"
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between min-w-0">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground break-words">
            Мои домашние задания
          </h1>
          <p className="text-sm text-muted-foreground mt-1 break-words">
            {isAdmin
              ? 'Все задания преподавателей и репетиторов'
              : user?.role === 'tutor'
                ? 'Создание и назначение заданий только своим ученикам'
                : 'Создание и назначение заданий ученикам после урока'}
          </p>
        </div>
        <Button
          onClick={() => navigate(createPageUrl('HomeworkEditor'))}
          className="gap-2 w-full sm:w-auto shrink-0"
          data-testid="homework-create"
        >
          <Plus className="h-4 w-4" />
          Создать задание
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 border-b border-border pb-2 min-w-0">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          const badge =
            item.id === 'review'
              ? reviewRows.length
              : item.id === 'assigned'
                ? assignments.length
                : item.id === 'history'
                  ? historyRows.length
                  : visibleRows.length;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex min-h-11 sm:min-h-10 items-center justify-center gap-1.5 sm:gap-2 rounded-lg px-2.5 sm:px-3 py-2 text-xs sm:text-sm transition min-w-0 ${
                active
                  ? 'bg-brand/10 text-brand font-medium'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
              data-testid={`homework-tab-${item.id}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate sm:hidden">{item.shortLabel}</span>
              <span className="hidden sm:inline truncate">{item.label}</span>
              <span className="text-xs opacity-70 shrink-0">{badge}</span>
            </button>
          );
        })}
      </div>

      {tab === 'created' && (
        <div className="space-y-4 min-w-0">
          {!isAdmin && (
            <div className="flex flex-wrap gap-2" data-testid="homework-library-segments">
              {LIBRARY_SEGMENTS.map((seg) => (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => {
                    setLibrarySegment(seg.id);
                    setSelectedIds([]);
                  }}
                  className={`inline-flex min-h-10 items-center rounded-lg px-3 text-sm ${
                    librarySegment === seg.id
                      ? 'bg-brand/10 text-brand font-medium'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                  data-testid={`homework-segment-${seg.id}`}
                >
                  {seg.label}
                </button>
              ))}
            </div>
          )}

          {isAdmin && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                className={fieldClass}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Все статусы</option>
                <option value="draft">Черновик</option>
                <option value="published">Опубликовано</option>
                <option value="archived">В архиве</option>
              </select>
              <select
                className={fieldClass}
                value={authorFilter}
                onChange={(e) => setAuthorFilter(e.target.value)}
              >
                <option value="">Все авторы</option>
                {authorOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {ownedSelectableIds.length > 0 && librarySegment !== 'shared' && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={
                    selectedIds.length > 0 &&
                    selectedIds.length === ownedSelectableIds.length
                  }
                  onChange={toggleSelectAllOwned}
                  data-testid="homework-select-all-owned"
                />
                Выбрать свои
              </label>
              <Button
                variant="outline"
                size="sm"
                disabled={selectedIds.length === 0}
                onClick={() => openGrantFor(selectedIds)}
                data-testid="homework-bulk-grant"
              >
                <Share2 className="h-3.5 w-3.5 mr-1" />
                Предоставить доступ ({selectedIds.length})
              </Button>
            </div>
          )}

          {visibleRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border">
              <EmptyState
                preset="homework"
                title={
                  librarySegment === 'shared'
                    ? 'Нет доступных вам заданий'
                    : 'Пока нет домашних заданий'
                }
                description={
                  librarySegment === 'shared'
                    ? 'Когда коллега предоставит доступ к шаблону, он появится здесь.'
                    : 'Создайте первое задание, чтобы назначить его ученикам.'
                }
                icon={BookOpen}
              />
            </div>
          ) : (
            <>
              <div className="md:hidden space-y-3">
                {visibleRows.map((hw) => (
                  <div
                    key={hw.id}
                    className="bg-card rounded-2xl border border-border p-4 min-w-0 overflow-x-hidden"
                    data-testid={`homework-card-${hw.id}`}
                    data-access-role={isSharedHomework(hw) ? 'shared' : 'owner'}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {!isSharedHomework(hw) && librarySegment !== 'shared' && (
                        <input
                          type="checkbox"
                          className="mt-1.5 h-4 w-4 shrink-0"
                          checked={selectedIds.includes(hw.id)}
                          onChange={() => toggleSelect(hw.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <h2 className="font-semibold text-foreground break-words [overflow-wrap:anywhere]">
                          {hw.title}
                        </h2>
                        <p className="text-xs text-muted-foreground mt-1 break-words">
                          {ACTIVITY_LABEL[hw.activity_kind] || hw.activity_kind}
                          {' · '}
                          {HW_STATUS_LABEL[hw.status] || hw.status}
                          {' · '}
                          вопросов: {hw.item_count ?? 0}
                        </p>
                        <p
                          className="text-xs text-muted-foreground mt-0.5 break-words"
                          data-testid={`homework-author-${hw.id}`}
                        >
                          {authorLabel(hw)}
                          {hw.created_at ? ` · ${formatDate(hw.created_at)}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {renderActions(hw, { compact: true })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block rounded-2xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted text-left text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium w-10" />
                        <th className="px-4 py-3 font-medium">Название</th>
                        <th className="px-4 py-3 font-medium">Тип</th>
                        <th className="px-4 py-3 font-medium">Создано</th>
                        <th className="px-4 py-3 font-medium">Автор</th>
                        <th className="px-4 py-3 font-medium">Вопросы</th>
                        <th className="px-4 py-3 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((hw) => (
                        <tr
                          key={hw.id}
                          className="border-t border-border bg-card"
                          data-access-role={isSharedHomework(hw) ? 'shared' : 'owner'}
                        >
                          <td className="px-4 py-3">
                            {!isSharedHomework(hw) && librarySegment !== 'shared' ? (
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={selectedIds.includes(hw.id)}
                                onChange={() => toggleSelect(hw.id)}
                              />
                            ) : null}
                          </td>
                          <td className="px-4 py-3 max-w-[220px]">
                            <div className="font-medium text-foreground break-words">
                              {hw.title}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {HW_STATUS_LABEL[hw.status] || hw.status}
                              {isSharedHomework(hw) ? ' · доступно вам' : ''}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {ACTIVITY_LABEL[hw.activity_kind] || hw.activity_kind}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {formatDate(hw.created_at)}
                          </td>
                          <td
                            className="px-4 py-3 max-w-[200px] break-words"
                            data-testid={`homework-author-${hw.id}`}
                          >
                            {authorLabel(hw)}
                          </td>
                          <td className="px-4 py-3">{hw.item_count ?? 0}</td>
                          <td className="px-4 py-3">{renderActions(hw)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'assigned' && (
        <AssignmentTable
          rows={assignments}
          emptyTitle="Пока нет назначений"
          emptyDescription="Назначьте задание ученикам — список появится здесь."
          onOpen={openAssignment}
        />
      )}

      {tab === 'review' && (
        <AssignmentTable
          rows={reviewRows}
          emptyTitle="Нет работ на проверке"
          emptyDescription="Когда ученики сдадут задания, они появятся в этой вкладке."
          onOpen={openAssignment}
        />
      )}

      {tab === 'history' && (
        <AssignmentTable
          rows={historyRows}
          emptyTitle="Выполненных работ пока нет"
          emptyDescription="Проверенные домашние задания сохраняются здесь — их можно открыть в любой момент."
          onOpen={openAssignment}
        />
      )}

      <HomeworkGrantAccessDialog
        open={grantOpen}
        onOpenChange={setGrantOpen}
        homeworkIds={grantHomeworkIds}
        homeworkTitles={grantTitles}
        onGranted={load}
      />
      <HomeworkAccessManageDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        homeworkId={manageTarget?.id}
        homeworkTitle={manageTarget?.title}
        onChanged={load}
      />
    </div>
  );
}

function AssignmentTable({ rows, emptyTitle, emptyDescription, onOpen }) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border">
        <EmptyState
          preset="homework"
          title={emptyTitle}
          description={emptyDescription}
          icon={Users}
        />
      </div>
    );
  }

  return (
    <>
      <div className="md:hidden space-y-3" data-testid="homework-assignment-cards">
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onOpen(row)}
            className="w-full text-left bg-card rounded-2xl border border-border p-4 space-y-2 min-w-0 overflow-hidden"
            data-testid={`homework-history-card-${row.id}`}
          >
            <div className="font-semibold text-foreground break-words">
              {row.title || 'Задание'}
            </div>
            <div className="text-sm text-foreground break-words">
              {row.learner_name || 'Ученик'}
            </div>
            <dl className="grid gap-1.5 text-xs text-muted-foreground">
              <div className="flex justify-between gap-2">
                <dt>Статус</dt>
                <dd className="text-foreground text-right">
                  {ASSIGNMENT_STATUS_LABEL[row.status] || row.status}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Выдано</dt>
                <dd className="text-foreground">{formatDate(row.assigned_at)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Сдано</dt>
                <dd className="text-foreground">
                  {formatDate(row.submitted_at || row.attempt_submitted_at)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Проверено</dt>
                <dd className="text-foreground">{formatDate(row.checked_at)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Результат</dt>
                <dd className="text-foreground font-medium">{formatResult(row)}</dd>
              </div>
            </dl>
            {(row.student_feedback || row.owner_comment) && (
              <p className="text-xs text-muted-foreground break-words border-t border-border pt-2">
                Комментарий: {row.student_feedback || row.owner_comment}
              </p>
            )}
          </button>
        ))}
      </div>

      <div className="hidden md:block rounded-2xl border border-border overflow-hidden min-w-0">
        <table className="w-full text-sm table-fixed">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-3 font-medium w-[18%]">Задание</th>
              <th className="px-3 py-3 font-medium w-[14%]">Ученик</th>
              <th className="px-3 py-3 font-medium w-[10%]">Статус</th>
              <th className="px-3 py-3 font-medium w-[10%]">Выдано</th>
              <th className="px-3 py-3 font-medium w-[10%]">Сдано</th>
              <th className="px-3 py-3 font-medium w-[10%]">Проверено</th>
              <th className="px-3 py-3 font-medium w-[10%]">Результат</th>
              <th className="px-3 py-3 font-medium w-[18%]">Комментарий</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-t border-border bg-card cursor-pointer hover:bg-muted/40"
                onClick={() => onOpen(row)}
                data-testid={`homework-history-row-${row.id}`}
              >
                <td className="px-3 py-3 break-words font-medium align-top">
                  {row.title || '—'}
                </td>
                <td className="px-3 py-3 break-words align-top">
                  {row.learner_name || '—'}
                </td>
                <td className="px-3 py-3 align-top">
                  {ASSIGNMENT_STATUS_LABEL[row.status] || row.status}
                </td>
                <td className="px-3 py-3 align-top">{formatDate(row.assigned_at)}</td>
                <td className="px-3 py-3 align-top">
                  {formatDate(row.submitted_at || row.attempt_submitted_at)}
                </td>
                <td className="px-3 py-3 align-top">{formatDate(row.checked_at)}</td>
                <td className="px-3 py-3 align-top">{formatResult(row)}</td>
                <td className="px-3 py-3 break-words align-top text-muted-foreground">
                  {row.student_feedback || row.owner_comment || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
