import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/api';
import {
  buildAutosavePayload,
  flattenAttemptQuestions,
  isQuestionAnswered,
} from '@/lib/assessment-ui';

/**
 * Attempt session: load state, local answers, debounced autosave, submit.
 */
export function useAttemptSession(attemptId) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | error
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  const saveTimers = useRef({});
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const questions = useMemo(() => flattenAttemptQuestions(state), [state]);

  const load = useCallback(async () => {
    if (!attemptId) return;
    setLoading(true);
    setError(null);
    try {
      const attemptState = await api.assessment.getAttemptState(attemptId);
      setState(attemptState);

      const initial = {};
      flattenAttemptQuestions(attemptState).forEach((q) => {
        const saved = q.saved_answer || {};
        initial[q.snapshot_id] = {
          selected_answer_snapshot_ids: saved.selected_answer_snapshot_ids || [],
          text: saved.text ?? '',
        };
      });
      setAnswers(initial);

      if (attemptState.status === 'submitted') {
        try {
          const result = await api.assessment.getResultByAttempt(attemptId);
          setSubmitResult({ attempt: attemptState, result });
        } catch {
          setSubmitResult({ attempt: attemptState, result: null });
        }
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    load();
    return () => {
      Object.values(saveTimers.current).forEach((t) => clearTimeout(t));
    };
  }, [load]);

  const persistAnswer = useCallback(
    async (questionSnapshotId) => {
      const local = answersRef.current[questionSnapshotId];
      setSaveStatus('saving');
      try {
        await api.assessment.autosaveAnswers(attemptId, [
          buildAutosavePayload(questionSnapshotId, local),
        ]);
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    },
    [attemptId],
  );

  const scheduleAutosave = useCallback(
    (questionSnapshotId) => {
      if (saveTimers.current[questionSnapshotId]) {
        clearTimeout(saveTimers.current[questionSnapshotId]);
      }
      saveTimers.current[questionSnapshotId] = setTimeout(() => {
        persistAnswer(questionSnapshotId);
      }, 450);
    },
    [persistAnswer],
  );

  const setSingleChoice = useCallback(
    (questionSnapshotId, answerSnapshotId) => {
      setAnswers((prev) => ({
        ...prev,
        [questionSnapshotId]: {
          selected_answer_snapshot_ids: [answerSnapshotId],
          text: prev[questionSnapshotId]?.text || '',
        },
      }));
      scheduleAutosave(questionSnapshotId);
    },
    [scheduleAutosave],
  );

  const toggleMultipleChoice = useCallback(
    (questionSnapshotId, answerSnapshotId) => {
      setAnswers((prev) => {
        const current = prev[questionSnapshotId]?.selected_answer_snapshot_ids || [];
        const next = current.includes(answerSnapshotId)
          ? current.filter((id) => id !== answerSnapshotId)
          : [...current, answerSnapshotId];
        return {
          ...prev,
          [questionSnapshotId]: {
            selected_answer_snapshot_ids: next,
            text: prev[questionSnapshotId]?.text || '',
          },
        };
      });
      scheduleAutosave(questionSnapshotId);
    },
    [scheduleAutosave],
  );

  const setTextAnswer = useCallback(
    (questionSnapshotId, text) => {
      setAnswers((prev) => ({
        ...prev,
        [questionSnapshotId]: {
          selected_answer_snapshot_ids:
            prev[questionSnapshotId]?.selected_answer_snapshot_ids || [],
          text,
        },
      }));
      scheduleAutosave(questionSnapshotId);
    },
    [scheduleAutosave],
  );

  const answeredCount = useMemo(
    () => questions.filter((q) => isQuestionAnswered(answers[q.snapshot_id])).length,
    [questions, answers],
  );

  const submit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      Object.values(saveTimers.current).forEach((t) => clearTimeout(t));
      const flush = questions.map((q) =>
        buildAutosavePayload(q.snapshot_id, answersRef.current[q.snapshot_id]),
      );
      const payload = await api.assessment.submitAttempt(attemptId, flush);
      setSubmitResult(payload);
      setState((prev) =>
        prev
          ? { ...prev, status: 'submitted', ...(payload.attempt || {}) }
          : prev,
      );
      return payload;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [attemptId, questions]);

  return {
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
    submit,
    reload: load,
  };
}
