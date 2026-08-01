import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, ClipboardCheck, History, Loader2, Plus, Send, Trash2, Users } from 'lucide-react';
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import { userFacingError } from '@/lib/userFacingError';

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
  { id: 'created', label: 'Созданные мной', shortLabel: 'Созданные', icon: BookOpen },
  { id: 'assigned', label: 'Назначенные ученикам', shortLabel: 'Назначенные', icon: Users },
  { id: 'review', label: 'Проверка', shortLabel: 'Проверка', icon: ClipboardCheck },
  { id: 'history', label: 'История', shortLabel: 'История', icon: History },
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

export default function HomeworkList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState('created');
  const [rows, setRows] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [hw, asg] = await Promise.all([
        api.homework.list(),
        api.homework.listAssignments(),
      ]);
      setRows(Array.isArray(hw) ? hw : []);
      setAssignments(Array.isArray(asg) ? asg : []);
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
    void load();
  }, []);

  const authorOptions = useMemo(
    () => [...new Set(rows.map((r) => r.owner_name).filter(Boolean))],
    [rows],
  );

  const visibleRows = rows.filter((hw) => {
    if (statusFilter && hw.status !== statusFilter) return false;
    if (authorFilter && hw.owner_name !== authorFilter) return false;
    return true;
  });

  const reviewRows = useMemo(
    () => assignments.filter((row) => row.status === 'submitted' || row.needs_manual_review),
    [assignments],
  );

  const historyRows = useMemo(
    () =>
      assignments.filter((row) =>
        ['checked', 'reviewed', 'expired', 'overdue', 'cancelled'].includes(row.status),
      ),
    [assignments],
  );

  const handleDelete = async (row) => {
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between min-w-0">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white break-words">
            Домашние задания
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 break-words">
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

      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 min-w-0">
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
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
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

          {visibleRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-8 sm:p-10 text-center text-slate-500">
              <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-50" />
              Пока нет домашних заданий. Создайте первое.
            </div>
          ) : (
            <>
              <div className="md:hidden space-y-3">
                {visibleRows.map((hw) => (
                  <div
                    key={hw.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-3 min-w-0"
                  >
                    <div className="min-w-0">
                      <h2 className="font-semibold text-slate-800 dark:text-slate-100 break-words">
                        {hw.title}
                      </h2>
                      <p className="text-xs text-slate-500 mt-1 break-words">
                        {ACTIVITY_LABEL[hw.activity_kind] || hw.activity_kind}
                        {' · '}
                        {HW_STATUS_LABEL[hw.status] || hw.status}
                        {' · '}
                        вопросов: {hw.item_count ?? 0}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 break-words">
                        {hw.owner_name ? `Автор: ${hw.owner_name}` : 'Автор: —'}
                        {hw.created_at ? ` · ${formatDate(hw.created_at)}` : ''}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => navigate(`${createPageUrl('HomeworkEditor')}?id=${hw.id}`)}
                      >
                        Редактировать
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() =>
                          navigate(`${createPageUrl('HomeworkAssignment')}?homeworkId=${hw.id}`)
                        }
                      >
                        <Send className="h-3.5 w-3.5 mr-1 shrink-0" />
                        Назначить
                      </Button>
                      <Link
                        to={`${createPageUrl('HomeworkResults')}?homeworkId=${hw.id}`}
                        className="inline-flex min-h-10 items-center justify-center px-3 text-xs rounded-md border border-slate-200 dark:border-slate-700"
                      >
                        Результаты
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={deletingId === hw.id}
                        onClick={() => handleDelete(hw)}
                      >
                        {deletingId === hw.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="h-3.5 w-3.5 mr-1 shrink-0" />
                            Удалить
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 text-left text-slate-500">
                      <tr>
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
                          className="border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900"
                        >
                          <td className="px-4 py-3 max-w-[220px]">
                            <div className="font-medium text-slate-800 dark:text-slate-100 break-words">
                              {hw.title}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {HW_STATUS_LABEL[hw.status] || hw.status}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {ACTIVITY_LABEL[hw.activity_kind] || hw.activity_kind}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">{formatDate(hw.created_at)}</td>
                          <td className="px-4 py-3 max-w-[160px] break-words">{hw.owner_name || '—'}</td>
                          <td className="px-4 py-3">{hw.item_count ?? 0}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  navigate(`${createPageUrl('HomeworkEditor')}?id=${hw.id}`)
                                }
                              >
                                Редактировать
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  navigate(
                                    `${createPageUrl('HomeworkAssignment')}?homeworkId=${hw.id}`,
                                  )
                                }
                              >
                                <Send className="h-3.5 w-3.5 mr-1" />
                                Назначить
                              </Button>
                              <Link
                                to={`${createPageUrl('HomeworkResults')}?homeworkId=${hw.id}`}
                                className="inline-flex items-center px-3 py-1.5 text-sm rounded-md border border-slate-200 dark:border-slate-700"
                              >
                                Результаты
                              </Link>
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
                            </div>
                          </td>
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
          empty="Пока нет назначений ученикам."
          onOpen={openAssignment}
          showDeadline
        />
      )}

      {tab === 'review' && (
        <AssignmentTable
          rows={reviewRows}
          empty="Нет заданий, ожидающих проверки."
          onOpen={openAssignment}
          showDeadline
          emphasizeStatus
        />
      )}

      {tab === 'history' && (
        <AssignmentTable
          rows={historyRows}
          empty="История завершённых заданий пуста."
          onOpen={openAssignment}
          history
        />
      )}
    </div>
  );
}

function AssignmentTable({ rows, empty, onOpen, showDeadline, history, emphasizeStatus }) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-8 sm:p-10 text-center text-slate-500">
        {empty}
      </div>
    );
  }

  return (
    <>
      <div className="md:hidden space-y-3">
        {rows.map((row) => (
          <div
            key={row.id}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-3 min-w-0"
          >
            <div className="min-w-0 space-y-1">
              <p className="font-semibold text-slate-800 dark:text-slate-100 break-words">
                {row.learner_name || '—'}
              </p>
              <p className="text-sm break-words">{row.title || '—'}</p>
              <p className="text-xs text-slate-500 break-words">
                {ACTIVITY_LABEL[row.activity_kind] || row.activity_kind || ''}
                {row.progress?.total
                  ? ` · ${row.progress.answered ?? 0}/${row.progress.total}`
                  : ''}
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-500 pt-1">
                <span>
                  {history ? 'Дата' : 'Назначено'}:{' '}
                  {formatDate(
                    history
                      ? row.checked_at || row.submitted_at || row.assigned_at
                      : row.assigned_at,
                  )}
                </span>
                {showDeadline && <span>Дедлайн: {formatDate(row.due_at)}</span>}
                {history ? (
                  <>
                    <span className="break-words">Результат: {formatResult(row)}</span>
                    <span className="break-words">
                      Проверил:{' '}
                      {row.checked_by_name ||
                        (row.status === 'checked' || row.status === 'reviewed' ? 'Авто' : '—')}
                    </span>
                  </>
                ) : (
                  <span
                    className={
                      emphasizeStatus
                        ? 'font-medium text-amber-700 dark:text-amber-400 col-span-2'
                        : 'col-span-2'
                    }
                  >
                    Статус: {ASSIGNMENT_STATUS_LABEL[row.status] || row.status}
                  </span>
                )}
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => onOpen(row)}>
              Открыть
            </Button>
          </div>
        ))}
      </div>

      <div className="hidden md:block rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Ученик</th>
                <th className="px-4 py-3 font-medium">Задание</th>
                <th className="px-4 py-3 font-medium">{history ? 'Дата' : 'Назначено'}</th>
                {showDeadline && <th className="px-4 py-3 font-medium">Дедлайн</th>}
                {history ? (
                  <>
                    <th className="px-4 py-3 font-medium">Результат</th>
                    <th className="px-4 py-3 font-medium">Кто проверил</th>
                  </>
                ) : (
                  <th className="px-4 py-3 font-medium">Статус</th>
                )}
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900"
                >
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100 max-w-[160px] break-words">
                    {row.learner_name || '—'}
                  </td>
                  <td className="px-4 py-3 max-w-[220px]">
                    <div className="break-words">{row.title || '—'}</div>
                    <div className="text-xs text-slate-500 mt-0.5 break-words">
                      {ACTIVITY_LABEL[row.activity_kind] || row.activity_kind || ''}
                      {row.progress?.total
                        ? ` · ${row.progress.answered ?? 0}/${row.progress.total}`
                        : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDate(
                      history
                        ? row.checked_at || row.submitted_at || row.assigned_at
                        : row.assigned_at,
                    )}
                  </td>
                  {showDeadline && (
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.due_at)}</td>
                  )}
                  {history ? (
                    <>
                      <td className="px-4 py-3 max-w-[140px] break-words">{formatResult(row)}</td>
                      <td className="px-4 py-3 max-w-[140px] break-words">
                        {row.checked_by_name ||
                          (row.status === 'checked' || row.status === 'reviewed' ? 'Авто' : '—')}
                      </td>
                    </>
                  ) : (
                    <td
                      className={`px-4 py-3 whitespace-nowrap ${
                        emphasizeStatus
                          ? 'font-medium text-amber-700 dark:text-amber-400'
                          : ''
                      }`}
                    >
                      {ASSIGNMENT_STATUS_LABEL[row.status] || row.status}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" onClick={() => onOpen(row)}>
                      Открыть
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
