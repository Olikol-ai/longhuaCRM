import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import { userFacingError } from '@/lib/userFacingError';

const STATUS_LABEL = {
  assigned: 'Назначено',
  in_progress: 'Выполняется',
  submitted: 'Отправлено',
  reviewed: 'Проверено',
  overdue: 'Просрочено',
};

export default function HomeworkResults() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const homeworkId = params.get('homeworkId');
  const assignmentId = params.get('assignmentId');
  const [rows, setRows] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.homework.listAssignments(homeworkId || undefined);
        setRows(Array.isArray(data) ? data : []);
        if (assignmentId) {
          const res = await api.homework.assignmentResult(assignmentId);
          setDetail(res);
        }
      } catch (err) {
        toast({
          title: 'Ошибка',
          description: userFacingError(err),
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [homeworkId, assignmentId]);

  const openResult = async (id) => {
    try {
      const res = await api.homework.assignmentResult(id);
      setDetail(res);
      navigate(`${createPageUrl('HomeworkResults')}?assignmentId=${id}${homeworkId ? `&homeworkId=${homeworkId}` : ''}`, { replace: true });
    } catch (err) {
      toast({
        title: 'Результат недоступен',
        description: userFacingError(err, 'Ученик ещё не сдал задание.'),
        variant: 'destructive',
      });
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
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6" data-testid="homework-results">
      <div>
        <h1 className="text-2xl font-bold">Результаты домашних заданий</h1>
        <p className="text-sm text-slate-500 mt-1">Баллы, процент, время и ошибки</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          {rows.length === 0 && (
            <p className="text-sm text-slate-500">Назначений пока нет.</p>
          )}
          {rows.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => openResult(a.id)}
              className="w-full text-left bg-white dark:bg-slate-900 border rounded-xl p-3 hover:border-brand/40"
            >
              <div className="font-medium">{a.title || 'Задание'}</div>
              <div className="text-xs text-slate-500 mt-1">
                {STATUS_LABEL[a.status] || a.status}
                {a.due_at ? ` · срок ${new Date(a.due_at).toLocaleString('ru-RU')}` : ''}
              </div>
            </button>
          ))}
        </div>

        <div className="bg-white dark:bg-slate-900 border rounded-2xl p-5 min-h-[200px]">
          {!detail ? (
            <p className="text-sm text-slate-500">Выберите назначение, чтобы увидеть результат.</p>
          ) : (
            <div className="space-y-3" data-testid="homework-result-detail">
              <h2 className="font-semibold text-lg">{detail.title}</h2>
              {detail.result ? (
                <>
                  <p className="text-sm">
                    Баллы: <strong>{detail.result.score}</strong> / {detail.result.max_score}
                  </p>
                  <p className="text-sm">Процент: <strong>{detail.result.percent}%</strong></p>
                  <p className="text-sm">
                    Время: {detail.result.duration_seconds != null
                      ? `${Math.round(detail.result.duration_seconds / 60)} мин`
                      : '—'}
                  </p>
                  <p className="text-sm">
                    Дата: {detail.submitted_at
                      ? new Date(detail.submitted_at).toLocaleString('ru-RU')
                      : '—'}
                  </p>
                  <div className="border-t pt-3 space-y-2">
                    <p className="text-xs font-semibold uppercase text-slate-400">Ответы</p>
                    {(detail.answers || []).map((a) => (
                      <div key={a.question_snapshot_id} className="text-sm">
                        {a.is_correct === true && <span className="text-emerald-600">✓ верно</span>}
                        {a.is_correct === false && <span className="text-red-600">✗ ошибка</span>}
                        {a.is_correct == null && <span className="text-amber-600">на проверке</span>}
                        {a.earned_points != null && (
                          <span className="text-slate-500 ml-2">{a.earned_points} б.</span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">Ещё нет результата.</p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(createPageUrl('HomeworkList'))}
              >
                К списку
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
