import { Link } from 'react-router-dom';
import { ClipboardCheck, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { useTeacherReviewQueue } from '@/hooks/useTeacherAssessment';
import { formatDateTime } from '@/lib/assessment-admin';

export default function TeacherAssessmentReview() {
  const { items, loading, error, reload } = useTeacherReviewQueue();

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Link
            to={createPageUrl('TeacherAssessment')}
            className="text-xs text-slate-500 hover:text-brand dark:hover:text-brand"
          >
            ← Мои экзамены
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            Работы на проверку
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Работы учеников, которые нужно проверить преподавателю
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => reload()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Обновить
        </Button>
      </div>

      {error && (
        <div
          className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-800 dark:text-rose-200"
          role="alert"
        >
          <p className="font-medium">Не удалось загрузить список</p>
          <p className="mt-1 opacity-90">{error.message || 'Ошибка сети'}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => reload()}>
            Повторить
          </Button>
        </div>
      )}

      {!error && items.length === 0 && (
        <div
          className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/40 p-10 text-center space-y-3"
          data-testid="teacher-review-empty"
        >
          <ClipboardCheck className="h-12 w-12 mx-auto text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Работ на проверку нет.
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Когда ученик сдаст экзамен с заданиями на проверку, работа появится здесь.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {items.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/80 via-white to-white dark:from-amber-950/20 dark:via-slate-900 dark:to-slate-900 p-5 shadow-sm"
            data-testid={`teacher-review-card-${item.id}`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
                  {item.student_name}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 truncate">
                  {item.exam_name}
                </p>
                <p className="text-xs text-slate-500">
                  Сдано: {formatDateTime(item.finished_at || item.created_at)}
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  {item.manual_question_count != null
                    ? `Заданий на проверку: ${item.manual_question_count}`
                    : 'Есть задания на проверку'}
                </p>
              </div>
              <Button asChild className="bg-primary hover:bg-primary/90 shrink-0">
                <Link
                  to={`${createPageUrl('TeacherAssessmentReviewDetail')}?id=${encodeURIComponent(item.id)}`}
                >
                  Проверить
                </Link>
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
