import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Loader2, Plus, Send, Trash2 } from 'lucide-react';
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import { userFacingError } from '@/lib/userFacingError';

const STATUS_LABEL = {
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

export default function HomeworkList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.homework.list();
      setRows(Array.isArray(data) ? data : []);
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

  const authorOptions = [...new Set(rows.map((r) => r.owner_name).filter(Boolean))];

  const visibleRows = rows.filter((hw) => {
    if (statusFilter && hw.status !== statusFilter) return false;
    if (authorFilter && hw.owner_name !== authorFilter) return false;
    return true;
  });

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

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6" data-testid="homework-list">
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
        <div className="space-y-3">
          {visibleRows.map((hw) => (
            <div
              key={hw.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <h2 className="font-semibold text-slate-800 dark:text-slate-100">{hw.title}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  {ACTIVITY_LABEL[hw.activity_kind] || hw.activity_kind}
                  {' · '}
                  {STATUS_LABEL[hw.status] || hw.status}
                  {hw.item_count != null ? ` · вопросов: ${hw.item_count}` : ''}
                  {hw.owner_name
                    ? ` · ${hw.owner_type === 'tutor' ? 'Репетитор' : 'Преподаватель'}: ${hw.owner_name}`
                    : ''}
                  {hw.created_at
                    ? ` · ${new Date(hw.created_at).toLocaleDateString('ru-RU')}`
                    : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
