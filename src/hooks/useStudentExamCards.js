import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api';
import {
  EXAM_UI_STATUS,
  findLatestSubmittedAttempt,
  findLiveAttempt,
  resolveExamCardStatus,
  unwrapItems,
} from '@/lib/assessment-ui';

/**
 * Loads student assignments + attempts + exam details for "Мои экзамены".
 */
export function useStudentExamCards() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [assignmentsPayload, attemptsPayload, resultsPayload] =
        await Promise.all([
          api.assessment.listAssignments({ limit: 200 }),
          api.assessment.listAttempts({ limit: 200 }),
          api.assessment.listResults({ limit: 200 }).catch(() => ({ items: [] })),
        ]);

      const assignments = unwrapItems(assignmentsPayload).filter(
        (a) => a.status !== 'cancelled',
      );
      const attempts = unwrapItems(attemptsPayload);
      const results = unwrapItems(resultsPayload);
      const resultByAttemptId = new Map(
        results
          .filter((r) => r?.attempt_id || r?.attemptId)
          .map((r) => [r.attempt_id || r.attemptId, r]),
      );

      const examIds = [...new Set(assignments.map((a) => a.exam_id).filter(Boolean))];
      const exams = await Promise.all(
        examIds.map((id) => api.assessment.getExam(id).catch(() => null)),
      );
      const examById = new Map(exams.filter(Boolean).map((e) => [e.id, e]));

      const nextCards = assignments.map((assignment) => {
        const exam = examById.get(assignment.exam_id);
        const examAttempts = attempts.filter((att) => att.exam_id === assignment.exam_id);
        const status = resolveExamCardStatus(examAttempts);
        const lastSubmitted = findLatestSubmittedAttempt(examAttempts);
        const result = lastSubmitted
          ? resultByAttemptId.get(lastSubmitted.id) || null
          : null;
        return {
          assignment,
          exam,
          status,
          liveAttempt: findLiveAttempt(examAttempts),
          lastSubmitted,
          result,
          title: exam?.name || 'Экзамен',
          description: exam?.description || '',
          durationMinutes: exam?.rule?.duration_minutes ?? null,
          assignedAt: assignment.valid_from || assignment.created_at,
          deadline: assignment.valid_to || exam?.available_to || null,
        };
      });

      nextCards.sort((a, b) => {
        const order = {
          [EXAM_UI_STATUS.IN_PROGRESS]: 0,
          [EXAM_UI_STATUS.NOT_STARTED]: 1,
          [EXAM_UI_STATUS.COMPLETED]: 2,
        };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9);
      });

      setCards(nextCards);
    } catch (err) {
      setError(err);
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { cards, loading, error, reload };
}
