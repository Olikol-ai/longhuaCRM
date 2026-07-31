import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import AutosaveStatus from '@/components/assessment/AutosaveStatus';
import ExamCompletionScreen from '@/components/assessment/ExamCompletionScreen';
import ExamProgress from '@/components/assessment/ExamProgress';
import ExamTimer from '@/components/assessment/ExamTimer';
import QuestionCard from '@/components/assessment/QuestionCard';
import TaskMaterialHeader from '@/components/assessment/TaskMaterialHeader';
import QuestionNavigator from '@/components/assessment/QuestionNavigator';
import { useAttemptSession } from '@/hooks/useAttemptSession';
import { userFacingError } from '@/lib/userFacingError';

export default function StudentExamTake() {
  const [params] = useSearchParams();
  const attemptId = params.get('attemptId') || '';
  const navigate = useNavigate();
  const [examTitle, setExamTitle] = useState('');
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const autoSubmitted = useRef(false);

  const session = useAttemptSession(attemptId);
  const {
    state,
    loading,
    error,
    questions,
    answers,
    currentIndex,
    setCurrentIndex,
    saveStatus,
    submitting,
    submitResult,
    answeredCount,
    setSingleChoice,
    toggleMultipleChoice,
    setTextAnswer,
    uploadSpeakingAnswer,
    submit,
  } = session;

  useEffect(() => {
    if (!state?.exam_id) return;
    api.assessment
      .getExam(state.exam_id)
      .then((exam) => setExamTitle(exam?.name || 'Экзамен'))
      .catch(() => setExamTitle('Экзамен'));
  }, [state?.exam_id]);

  const completedPayload = submitResult;
  const isSubmitted =
    Boolean(completedPayload) || state?.status === 'submitted';

  useEffect(() => {
    if (!state?.expires_at || isSubmitted) {
      setRemainingSeconds(null);
      return undefined;
    }

    const tick = () => {
      const ms = new Date(state.expires_at).getTime() - Date.now();
      setRemainingSeconds(Math.max(0, Math.floor(ms / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state?.expires_at, isSubmitted]);

  const handleTimeoutSubmit = useCallback(async () => {
    if (autoSubmitted.current || isSubmitted || submitting) return;
    autoSubmitted.current = true;
    try {
      await submit();
      toast({
        title: 'Время истекло',
        description: 'Экзамен отправлен автоматически.',
      });
    } catch (err) {
      toast({
        title: 'Не удалось отправить экзамен',
        description: userFacingError(err, 'Попробуйте ещё раз.'),
        variant: 'destructive',
      });
      autoSubmitted.current = false;
    }
  }, [isSubmitted, submitting, submit]);

  useEffect(() => {
    if (remainingSeconds === 0 && state?.status === 'started') {
      handleTimeoutSubmit();
    }
  }, [remainingSeconds, state?.status, handleTimeoutSubmit]);

  const currentQuestion = questions[currentIndex] || null;

  const resultEntity = useMemo(() => {
    if (!completedPayload) return null;
    return completedPayload.result || completedPayload;
  }, [completedPayload]);

  const handleManualSubmit = async () => {
    setConfirmSubmit(false);
    try {
      await submit();
    } catch (err) {
      toast({
        title: 'Не удалось завершить экзамен',
        description: userFacingError(err, 'Попробуйте ещё раз.'),
        variant: 'destructive',
      });
    }
  };

  if (!attemptId) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center space-y-4">
        <p className="text-slate-600 dark:text-slate-300">Не указана попытка экзамена.</p>
        <Button asChild variant="outline">
          <Link to={createPageUrl('StudentExams')}>К списку экзаменов</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-brand" />
        <p className="text-sm text-slate-500">Загрузка экзамена…</p>
      </div>
    );
  }

  if (error && !state) {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-4">
        <div
          className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-800 dark:text-rose-200"
          role="alert"
        >
          <p className="font-medium">Не удалось открыть экзамен</p>
          <p className="mt-1">{userFacingError(error, 'Не удалось загрузить экзамен')}</p>
        </div>
        <Button asChild variant="outline">
          <Link to={createPageUrl('StudentExams')}>Назад</Link>
        </Button>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <ExamCompletionScreen
        result={resultEntity}
        examTitle={examTitle}
        onBack={() => navigate(createPageUrl('StudentExams'))}
      />
    );
  }

  if (questions.length === 0) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center space-y-4">
        <p className="text-slate-600 dark:text-slate-300">В этом экзамене нет вопросов.</p>
        <Button asChild variant="outline">
          <Link to={createPageUrl('StudentExams')}>Назад</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/80 dark:bg-slate-950/40">
      <div className="sticky top-0 z-20 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-slate-900/80">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 py-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <Link
                to={createPageUrl('StudentExams')}
                className="text-xs text-slate-500 hover:text-brand dark:hover:text-brand"
              >
                ← Мои экзамены
              </Link>
              <h1 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white truncate">
                {examTitle || 'Экзамен'}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <AutosaveStatus status={saveStatus} />
              {state?.expires_at ? (
                <ExamTimer
                  remainingSeconds={remainingSeconds}
                  expired={remainingSeconds === 0}
                />
              ) : null}
            </div>
          </div>
          <ExamProgress
            current={currentIndex + 1}
            total={questions.length}
            answeredCount={answeredCount}
          />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 pb-28 sm:pb-8">
        <div className="hidden sm:block">
          <QuestionNavigator
            questions={questions}
            answers={answers}
            currentIndex={currentIndex}
            onSelect={setCurrentIndex}
          />
        </div>

        <TaskMaterialHeader
          instructions={currentQuestion?.task_instructions}
          vocabulary={currentQuestion?.vocabulary}
          passageText={currentQuestion?.passage_text}
        />
        <QuestionCard
          question={currentQuestion}
          index={currentIndex}
          localAnswer={answers[currentQuestion?.snapshot_id]}
          onSingleChoice={setSingleChoice}
          onToggleMultiple={toggleMultipleChoice}
          onTextChange={setTextAnswer}
          onSpeakingUpload={uploadSpeakingAnswer}
        />

        <div className="sm:hidden overflow-x-auto -mx-1 px-1 pb-1">
          <QuestionNavigator
            questions={questions}
            answers={answers}
            currentIndex={currentIndex}
            onSelect={setCurrentIndex}
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={currentIndex <= 0}
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              className="flex-1 sm:flex-none"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Назад
            </Button>
            <Button
              variant="outline"
              disabled={currentIndex >= questions.length - 1}
              onClick={() =>
                setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))
              }
              className="flex-1 sm:flex-none"
            >
              Далее
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          <Button
            className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
            disabled={submitting}
            onClick={() => setConfirmSubmit(true)}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Отправка…
              </>
            ) : (
              'Завершить экзамен'
            )}
          </Button>
        </div>
      </div>

      {confirmSubmit && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4 shadow-xl safe-pb sm:pb-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Завершить экзамен?
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Отвечено {answeredCount} из {questions.length}. После отправки изменить ответы будет
              нельзя.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => setConfirmSubmit(false)}>
                Отмена
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90"
                disabled={submitting}
                onClick={handleManualSubmit}
              >
                Подтвердить
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
