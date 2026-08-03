import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import AutosaveStatus from '@/components/assessment/AutosaveStatus';
import AttemptFinishDialog from '@/components/assessment/AttemptFinishDialog';
import AttemptNavBar from '@/components/assessment/AttemptNavBar';
import ExamCompletionScreen from '@/components/assessment/ExamCompletionScreen';
import ExamProgress from '@/components/assessment/ExamProgress';
import ExamTimer from '@/components/assessment/ExamTimer';
import LearnerQuestionBlocks from '@/components/assessment/LearnerQuestionBlocks';
import QuestionNavigator from '@/components/assessment/QuestionNavigator';
import { useAttemptSession } from '@/hooks/useAttemptSession';
import { userFacingError } from '@/lib/userFacingError';
import {
  findDisplayBlockForIndex,
  groupQuestionsForLearnerDisplay,
} from '@/lib/listening-display';
import { stopAllLearningAudio } from '@/lib/learning-audio-runtime';

export default function StudentExamTake() {
  const [params] = useSearchParams();
  const attemptId = params.get('attemptId') || '';
  const navigate = useNavigate();
  const [examTitle, setExamTitle] = useState('');
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmEarly, setConfirmEarly] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const autoSubmitted = useRef(false);
  const stageTopRef = useRef(null);

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

  const displayBlocks = useMemo(
    () => groupQuestionsForLearnerDisplay(questions),
    [questions],
  );
  const currentBlock = useMemo(
    () => findDisplayBlockForIndex(displayBlocks, currentIndex),
    [displayBlocks, currentIndex],
  );

  const resultEntity = useMemo(() => {
    if (!completedPayload) return null;
    return completedPayload.result || completedPayload;
  }, [completedPayload]);

  const goToQuestion = (nextIndex) => {
    const nextBlock = findDisplayBlockForIndex(displayBlocks, nextIndex);
    const sameListeningBlock =
      nextBlock?.type === 'listening' &&
      currentBlock?.type === 'listening' &&
      nextBlock.audioKey === currentBlock.audioKey &&
      nextBlock.startIndex === currentBlock.startIndex;

    if (!sameListeningBlock) {
      stopAllLearningAudio();
    }

    setCurrentIndex(nextIndex);
    requestAnimationFrame(() => {
      if (sameListeningBlock) {
        document
          .getElementById(`learner-question-${nextIndex}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      stageTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      requestAnimationFrame(() => {
        document
          .getElementById(`learner-question-${nextIndex}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  };

  const handleManualSubmit = async () => {
    setConfirmSubmit(false);
    setConfirmEarly(false);
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
      <div ref={stageTopRef} className="h-0 w-0 overflow-hidden" aria-hidden />
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

      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 pb-28 sm:pb-8 learner-content">
        <div className="hidden sm:block">
          <QuestionNavigator
            questions={questions}
            answers={answers}
            currentIndex={currentIndex}
            onSelect={goToQuestion}
          />
        </div>

        <LearnerQuestionBlocks
          questions={questions}
          answers={answers}
          currentIndex={currentIndex}
          mode="focus"
          highlightCurrent
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
            onSelect={goToQuestion}
          />
        </div>

        <AttemptNavBar
          index={currentIndex}
          total={questions.length}
          submitting={submitting}
          finishLabel="Завершить экзамен"
          earlyFinishLabel="Завершить"
          onPrev={() => goToQuestion(Math.max(0, currentIndex - 1))}
          onNext={() => goToQuestion(Math.min(questions.length - 1, currentIndex + 1))}
          onFinish={() => setConfirmSubmit(true)}
          onRequestEarlyFinish={() => setConfirmEarly(true)}
        />
      </div>

      <AttemptFinishDialog
        open={confirmSubmit || confirmEarly}
        answeredCount={answeredCount}
        total={questions.length}
        submitting={submitting}
        title="Завершить экзамен?"
        isEarly={confirmEarly}
        onContinue={() => {
          setConfirmSubmit(false);
          setConfirmEarly(false);
        }}
        onConfirm={handleManualSubmit}
      />
    </div>
  );
}
