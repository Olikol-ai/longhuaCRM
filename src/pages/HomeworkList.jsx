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
  { id: 'created', label: 'Созданные мной', icon: BookOpen },
  { id: 'assigned', label: 'Назначенные ученикам', icon: Users },
  { id: 'review', label: 'Проверка', icon: ClipboardCheck },
  { id: 'history', label: 'История', icon: History },
];

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
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6" data-testid="homework-list">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Домашние задания</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isAdmin
              ? 'Все задания преподавателей и репетиторов'
              : user?.role === 'tutor'
                ? 'Создание и назначение заданий только своим ученикам'
                : 'Создание и назначение заданий ученикам после урока'}
          </p>
        </div>
        <Button
          onClick={() => navigate(createPageUrl('HomeworkEditor'))}
          className="gap-2"
          data-testid="homework-create"
        >
          <Plus className="h-4 w-4" />
          Создать задание
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
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
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? 'bg-brand/10 text-brand font-medium'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              data-testid={`homework-tab-${item.id}`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
              <span className="text-xs opacity-70">{badge}</span>
            </button>
          );
        })}
      </div>

      {tab === 'created' && (
        <div className="space-y-4">
          {isAdmin && (
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm sm:w-48"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Все статусы</option>
                <option value="draft">Черновик</option>
                <option value="published">Опубликовано</option>
                <option value="archived">В архиве</option>
              </select>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm sm:w-56"
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
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-10 text-center text-slate-500">
              <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-50" />
              Пока нет домашних заданий. Создайте первое.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
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
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 dark:text-slate-100">{hw.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {HW_STATUS_LABEL[hw.status] || hw.status}
                        </div>
                      </td>
                      <td className="px-4 py-3">{ACTIVITY_LABEL[hw.activity_kind] || hw.activity_kind}</td>
                      <td className="px-4 py-3">{formatDate(hw.created_at)}</td>
                      <td className="px-4 py-3">{hw.owner_name || '—'}</td>
                      <td className="px-4 py-3">{hw.item_count ?? 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`${createPageUrl('HomeworkEditor')}?id=${hw.id}`)}
                          >
                            Редактировать
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              navigate(`${createPageUrl('HomeworkAssignment')}?homeworkId=${hw.id}`)
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
      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-10 text-center text-slate-500">
        {empty}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
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
              <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                {row.learner_name || '—'}
              </td>
              <td className="px-4 py-3">
                <div>{row.title || '—'}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {ACTIVITY_LABEL[row.activity_kind] || row.activity_kind || ''}
                  {row.progress?.total
                    ? ` · ${row.progress.answered ?? 0}/${row.progress.total}`
                    : ''}
                </div>
              </td>
              <td className="px-4 py-3">
                {formatDate(history ? row.checked_at || row.submitted_at || row.assigned_at : row.assigned_at)}
              </td>
              {showDeadline && <td className="px-4 py-3">{formatDate(row.due_at)}</td>}
              {history ? (
                <>
                  <td className="px-4 py-3">{formatResult(row)}</td>
                  <td className="px-4 py-3">
                    {row.checked_by_name || (row.status === 'checked' || row.status === 'reviewed' ? 'Авто' : '—')}
                  </td>
                </>
              ) : (
                <td className={`px-4 py-3 ${emphasizeStatus ? 'font-medium text-amber-700 dark:text-amber-400' : ''}`}>
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
  );
}
