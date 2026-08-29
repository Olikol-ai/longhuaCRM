import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import LearnerItemReview from '@/components/assessment/LearnerItemReview';
import { ResultStatusBadge } from '@/components/assessment/StatusBadges';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import AuthenticatedAudio from '@/components/media/AuthenticatedAudio';
import { useStudentExamFeedback } from '@/hooks/useStudentExamFeedback';
import {
  buildExamItemReview,
  formatStudentExamAnswer,
} from '@/lib/exam-item-review';
import {
  EVALUATION_TYPE_LABEL,
  formatDateTime,
  formatDurationSeconds,
} from '@/lib/assessment-admin';
import { createPageUrl } from '@/utils';
import { withAccessToken } from '@/lib/auth-media-url';

const TYPE_LABEL = {
  single_choice: 'Один ответ',
  multiple_choice: 'Несколько ответов',
  listening: 'Аудирование',
  short_text: 'Текстовый ответ',
  translation: 'Развёрнутый ответ',
  speaking: 'Speaking',
};

export default function StudentExamFeedback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const resultId = params.get('resultId') || '';
  const { result, examTitle, items, loading, error } =
    useStudentExamFeedback(resultId);

  if (!resultId) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center space-y-4">
        <p>Не указан результат.</p>
        <Button asChild variant="outline">
          <Link to={createPageUrl('StudentExams')}>К экзаменам</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (error || !result) {
    const forbidden = error?.cause?.status === 403 || /прав|forbidden/i.test(error?.message || '');
    return (
      <div
        className="p-6 max-w-lg mx-auto space-y-4"
        data-testid={forbidden ? 'student-exam-feedback-forbidden' : 'student-exam-feedback-error'}
      >
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-800 dark:text-rose-200">
          <p className="font-medium">{forbidden ? '403 Недостаточно прав' : 'Ошибка'}</p>
          <p className="mt-1">{error?.message || 'Результат не найден'}</p>
        </div>
        <Button asChild variant="outline">
          <Link to={createPageUrl('StudentExams')}>Назад</Link>
        </Button>
      </div>
    );
  }

  return (
    <div
      className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6 pb-16 min-w-0 overflow-x-hidden"
      data-testid="student-exam-feedback"
    >
      <div>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-brand"
          onClick={() => navigate(createPageUrl('StudentExams'))}
        >
          ← Мои экзамены
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground break-words">
            {examTitle || 'Результат экзамена'}
          </h1>
          <ResultStatusBadge status={result.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Попытка #{result.attempt_number}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Балл</p>
          <p className="mt-1 text-xl font-semibold text-foreground">
            {result.score}
            <span className="text-sm font-normal text-muted-foreground">
              {' '}
              / {result.max_score}
            </span>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Процент</p>
          <p className="mt-1 text-xl font-semibold text-foreground">
            {result.percent != null ? `${Number(result.percent).toFixed(0)}%` : '—'}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Длительность</p>
          <p className="mt-1 text-xl font-semibold text-foreground">
            {formatDurationSeconds(result.duration)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Оценка</p>
          <p className="mt-1.5 text-sm font-medium text-foreground">
            {EVALUATION_TYPE_LABEL[result.evaluation_type] ||
              result.evaluation_type ||
              '—'}
          </p>
        </Card>
      </div>

      <Card className="space-y-2 p-4 text-sm text-muted-foreground sm:p-5">
        <p>
          <span className="text-muted-foreground">Начало: </span>
          {formatDateTime(result.started_at)}
        </p>
        <p>
          <span className="text-muted-foreground">Окончание: </span>
          {formatDateTime(result.finished_at)}
        </p>
      </Card>

      <section className="space-y-4" data-testid="student-exam-feedback-items">
        <h2 className="font-semibold text-foreground">Разбор по вопросам</h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Детализация по вопросам пока недоступна.
          </p>
        ) : (
          items.map((item, index) => {
            const review = buildExamItemReview(item);
            return (
              <Card
                key={item.question_snapshot_id}
                className="space-y-3 p-4 sm:p-5 min-w-0 overflow-x-hidden"
                data-testid={`student-exam-feedback-item-${index}`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    Вопрос №{index + 1}
                    {TYPE_LABEL[item.type] ? ` · ${TYPE_LABEL[item.type]}` : ''}
                  </p>
                  <p className="mt-1 text-base font-medium text-foreground whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                    {item.stem}
                  </p>
                </div>

                <div className="min-w-0 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Ваш ответ
                  </p>
                  <p className="mt-1 text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                    {formatStudentExamAnswer(item)}
                  </p>
                  {item.has_audio && item.audio_url ? (
                    <div className="mt-2">
                      <AuthenticatedAudio
                        src={withAccessToken(item.audio_url)}
                        wrapperClassName="mt-1"
                      />
                    </div>
                  ) : null}
                </div>

                <LearnerItemReview review={review} />
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}
