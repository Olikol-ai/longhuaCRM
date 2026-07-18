import { Link } from 'react-router-dom';
import {
  ClipboardList,
  FileSearch,
  Loader2,
  RefreshCw,
  Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResultStatusBadge } from '@/components/assessment/StatusBadges';
import { createPageUrl } from '@/utils';
import { useTeacherAssessmentCards } from '@/hooks/useTeacherAssessment';
import {
  RESULT_STATUS_LABEL,
  formatDateTime,
} from '@/lib/assessment-admin';

const ASSIGNMENT_STATUS_LABEL = {
  draft: 'Черновик',
  active: 'Активно',
  cancelled: 'Отменено',
  expired: 'Истекло',
  scheduled: 'Запланировано',
};

export default function TeacherAssessment() {
  const { cards, loading, error, reload } = useTeacherAssessmentCards();

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-1">
            <ClipboardList className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wide">Экзамены</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Мои экзамены
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Экзамены учеников, назначенные вам или вашим группам
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={createPageUrl('TeacherAssessmentReview')}>
              <FileSearch className="h-4 w-4 mr-2" />
              На проверку
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to={createPageUrl('TeacherAssessmentResults')}>
              <Trophy className="h-4 w-4 mr-2" />
              Результаты
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Обновить
          </Button>
        </div>
      </div>

      {error && (
        <div
          className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-800 dark:text-rose-200"
          role="alert"
        >
          <p className="font-medium">Не удалось загрузить экзамены</p>
          <p className="mt-1 opacity-90">{error.message || 'Ошибка сети'}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => reload()}>
            Повторить
          </Button>
        </div>
      )}

      {!error && cards.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/40 p-10 text-center space-y-3">
          <ClipboardList className="h-12 w-12 mx-auto text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Пока нет назначенных экзаменов
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Когда администратор назначит экзамен вашим ученикам, он появится здесь.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {cards.map((card) => (
          <article
            key={card.assignment.id}
            className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-5 sm:p-6 shadow-sm"
            data-testid={`teacher-exam-card-${card.assignment.id}`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
                  {card.examName}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {card.studentName}
                </p>
                <p className="text-xs text-slate-500">
                  Назначен: {formatDateTime(card.assignment.created_at)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200">
                  {ASSIGNMENT_STATUS_LABEL[card.assignment.status] ||
                    card.assignment.status}
                </span>
                {card.resultStatus ? (
                  <ResultStatusBadge status={card.resultStatus} />
                ) : (
                  <span className="text-xs text-slate-400">Нет результата</span>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-400">
              <p>
                Попыток:{' '}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {card.attemptCount}
                </span>
              </p>
              <p>
                Результат:{' '}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {card.resultStatus
                    ? RESULT_STATUS_LABEL[card.resultStatus] || card.resultStatus
                    : '—'}
                </span>
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
