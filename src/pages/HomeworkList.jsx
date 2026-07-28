import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Loader2, Plus, Send } from 'lucide-react';
import { api } from '@/api';
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
  reading: 'Reading',
  listening: 'Listening',
  speaking: 'Speaking',
  writing: 'Writing',
};

export default function HomeworkList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

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
            Создание и назначение заданий ученикам после урока
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

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-10 text-center text-slate-500">
          <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-50" />
          Пока нет домашних заданий. Создайте первое.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((hw) => (
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
                  onClick={() => navigate(`${createPageUrl('HomeworkAssignment')}?homeworkId=${hw.id}`)}
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
