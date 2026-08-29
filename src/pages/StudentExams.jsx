import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Loader2, RefreshCw } from 'lucide-react';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import ExamAssignmentCard from '@/components/assessment/ExamAssignmentCard';
import { useStudentExamCards } from '@/hooks/useStudentExamCards';
import { EXAM_UI_STATUS, isExamResultReviewed } from '@/lib/assessment-ui';
import { userFacingError } from '@/lib/userFacingError';

export default function StudentExams() {
  const navigate = useNavigate();
  const { cards, loading, error, reload } = useStudentExamCards();
  const [busyId, setBusyId] = useState(null);

  const goTake = (attemptId) => {
    navigate(`${createPageUrl('StudentExamTake')}?attemptId=${encodeURIComponent(attemptId)}`);
  };

  const handleStart = async (card) => {
    setBusyId(card.assignment.id);
    try {
      const state = await api.assessment.startAttempt({
        exam_id: card.assignment.exam_id,
        assignment_id: card.assignment.id,
      });
      goTake(state.id);
    } catch (err) {
      if (err?.status === 409 && card.liveAttempt?.id) {
        goTake(card.liveAttempt.id);
        return;
      }
      toast({
        title: 'Не удалось начать экзамен',
        description: userFacingError(err, 'Попробуйте ещё раз или обратитесь к администратору.'),
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleContinue = (card) => {
    if (card.liveAttempt?.id) {
      goTake(card.liveAttempt.id);
      return;
    }
    handleStart(card);
  };

  const handleViewResult = async (card) => {
    const attemptId = card.lastSubmitted?.id;
    if (!attemptId) {
      toast({
        title: 'Результат недоступен',
        description: 'Завершённая попытка не найдена.',
        variant: 'destructive',
      });
      return;
    }

    let result = card.result;
    if (!result?.id) {
      try {
        result = await api.assessment.getResultByAttempt(attemptId);
      } catch (err) {
        toast({
          title: 'Результат недоступен',
          description: userFacingError(err, 'Не удалось загрузить результат.'),
          variant: 'destructive',
        });
        return;
      }
    }

    if (!isExamResultReviewed(result)) {
      toast({
        title: 'Ожидает проверки',
        description:
          'Преподаватель ещё не проверил работу. Разбор ответов появится после проверки.',
      });
      return;
    }

    if (!result?.id) {
      toast({
        title: 'Результат недоступен',
        description: 'Идентификатор результата не найден.',
        variant: 'destructive',
      });
      return;
    }

    navigate(
      `${createPageUrl('StudentExamFeedback')}?resultId=${encodeURIComponent(result.id)}`,
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Мои экзамены</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Назначенные экзамены: статус, сроки и переход к сдаче
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="self-start sm:self-auto"
          onClick={() => reload()}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Обновить
        </Button>
      </div>

      {error && (
        <div
          className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-800 dark:text-rose-200"
          role="alert"
        >
          <p className="font-medium">Не удалось загрузить экзамены</p>
          <p className="mt-1 opacity-90">{userFacingError(error, 'Ошибка сети')}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => reload()}>
            Повторить
          </Button>
        </div>
      )}

      {!error && cards.length === 0 && (
        <div
          className="relative overflow-hidden rounded-3xl border border-dashed border-brand/30 dark:border-brand/40 bg-gradient-to-br from-brand-soft via-white to-slate-50 dark:from-slate-900 dark:via-slate-950 dark:to-brand-soft/40 p-10 sm:p-14 text-center space-y-4"
          data-testid="student-exams-empty"
        >
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-muted dark:bg-brand-soft/60">
            <ClipboardList className="h-10 w-10 text-brand dark:text-brand" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">
            Пока вам не назначено ни одного экзамена.
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Когда преподаватель назначит экзамен, он появится здесь — вы сможете
            прочитать описание и начать сдачу.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {cards.map((card) => (
          <ExamAssignmentCard
            key={card.assignment.id}
            card={card}
            busy={busyId === card.assignment.id}
            onStart={handleStart}
            onContinue={handleContinue}
            onViewResult={handleViewResult}
          />
        ))}
      </div>

      {cards.some((c) => c.status === EXAM_UI_STATUS.IN_PROGRESS) && (
        <p className="text-xs text-muted-foreground text-center">
          Незавершённый экзамен можно продолжить — ответы сохраняются автоматически.
        </p>
      )}
    </div>
  );
}
