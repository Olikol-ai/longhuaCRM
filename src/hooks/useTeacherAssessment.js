import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api';
import { displayPersonName, isManualReviewQuestionType } from '@/lib/assessment-admin';
import { unwrapItems } from '@/lib/assessment-ui';
import {
  filterExamResults,
  isExamResultCompleted,
  isExamResultPending,
  isTeacherExamAssignmentCurrent,
} from '@/lib/teacher-work-history';

/**
 * Assignments visible to the teacher (ACL-filtered) with exam/student/attempt/result meta.
 */
export function useTeacherAssessmentCards() {
  const [cards, setCards] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [assignmentsPayload, examsPayload, attemptsPayload, resultsPayload, studentsPayload] =
        await Promise.all([
          api.assessment.listAssignments({ limit: 200 }),
          api.assessment.listExams({ limit: 200 }),
          api.assessment.listAttempts({ limit: 200 }),
          api.assessment.listResults({ limit: 200 }),
          api.students.list().catch(() => []),
        ]);

      const exams = new Map(unwrapItems(examsPayload).map((e) => [e.id, e]));
      const students = Array.isArray(studentsPayload)
        ? studentsPayload
        : unwrapItems(studentsPayload);
      const studentById = new Map(students.map((s) => [s.id, s]));
      const attempts = unwrapItems(attemptsPayload);
      const resultRows = unwrapItems(resultsPayload);
      const resultByAttempt = new Map(resultRows.map((r) => [r.attempt_id, r]));
      const attemptById = new Map(attempts.map((a) => [a.id, a]));

      const cardsBuilt = unwrapItems(assignmentsPayload).map((assignment) => {
        const exam = exams.get(assignment.exam_id);
        const relatedAttempts = attempts.filter(
          (a) => a.assignment_id === assignment.id || a.exam_id === assignment.exam_id,
        );
        const studentAttempts =
          assignment.target_type === 'student'
            ? relatedAttempts.filter((a) => a.student_id === assignment.target_id)
            : relatedAttempts;

        const attemptCount = studentAttempts.length;
        const latestAttempt = [...studentAttempts].sort((a, b) => {
          const ta = new Date(a.submitted_at || a.started_at || a.created_at || 0).getTime();
          const tb = new Date(b.submitted_at || b.started_at || b.created_at || 0).getTime();
          return tb - ta;
        })[0];
        const latestResult = latestAttempt
          ? resultByAttempt.get(latestAttempt.id)
          : null;

        let studentName = '—';
        if (assignment.target_type === 'student') {
          studentName =
            displayPersonName(studentById.get(assignment.target_id)) ||
            assignment.target_id;
        } else if (assignment.target_type === 'group') {
          studentName = 'Группа';
        } else if (assignment.target_type === 'course') {
          studentName = 'Курс';
        } else {
          studentName = assignment.target_type || '—';
        }

        return {
          assignment,
          exam,
          examName: exam?.name || 'Экзамен',
          studentName,
          attemptCount,
          resultId: latestResult?.id || null,
          resultStatus: latestResult?.status || null,
          resultPassed: latestResult?.passed ?? null,
          resultScore: latestResult?.score ?? null,
          resultMaxScore: latestResult?.max_score ?? null,
          resultPercent: latestResult?.percent ?? null,
          resultFinishedAt: latestResult?.finished_at || latestResult?.updated_at || null,
        };
      });

      cardsBuilt.sort((a, b) => {
        const ta = new Date(a.assignment.created_at || 0).getTime();
        const tb = new Date(b.assignment.created_at || 0).getTime();
        return tb - ta;
      });

      const enrichedResults = resultRows.map((row) => {
        const attempt = attemptById.get(row.attempt_id);
        const sid = attempt?.student_id;
        return {
          ...row,
          exam_name: exams.get(row.exam_id)?.name || 'Экзамен',
          student_id: sid || null,
          student_name: sid
            ? displayPersonName(studentById.get(sid)) || sid
            : '—',
        };
      });
      enrichedResults.sort((a, b) => {
        const ta = new Date(a.finished_at || a.created_at || 0).getTime();
        const tb = new Date(b.finished_at || b.created_at || 0).getTime();
        return tb - ta;
      });

      setCards(cardsBuilt);
      setResults(enrichedResults);
    } catch (err) {
      setError(err);
      setCards([]);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { cards, results, loading, error, reload };
}

export function useTeacherReviewQueue() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resultsPayload, examsPayload, attemptsPayload, studentsPayload] =
        await Promise.all([
          api.assessment.listResults({ limit: 200 }),
          api.assessment.listExams({ limit: 200 }),
          api.assessment.listAttempts({ limit: 200 }),
          api.students.list().catch(() => []),
        ]);

      const examName = new Map(unwrapItems(examsPayload).map((e) => [e.id, e.name]));
      const students = Array.isArray(studentsPayload)
        ? studentsPayload
        : unwrapItems(studentsPayload);
      const studentName = new Map(students.map((s) => [s.id, displayPersonName(s)]));
      const attempts = unwrapItems(attemptsPayload);
      const attemptById = new Map(attempts.map((a) => [a.id, a]));

      const itemsBuilt = unwrapItems(resultsPayload)
        .filter((r) => isExamResultPending(r))
        .map((row) => {
          const attempt = attemptById.get(row.attempt_id);
          const sid = attempt?.student_id;
          return {
            ...row,
            exam_name: examName.get(row.exam_id) || 'Экзамен',
            student_id: sid || null,
            student_name: sid ? studentName.get(sid) || sid : '—',
            manual_question_count: null,
          };
        });

      const enriched = await Promise.all(
        itemsBuilt.map(async (row) => {
          if (!row.attempt_id) return row;
          try {
            const state = await api.assessment.getAttemptState(row.attempt_id);
            const questions = (state?.sections || []).flatMap((s) => s.questions || []);
            const manual_question_count = questions.filter(
              (q) => isManualReviewQuestionType(q.type),
            ).length;
            return { ...row, manual_question_count };
          } catch {
            return row;
          }
        }),
      );

      enriched.sort((a, b) => {
        const ta = new Date(a.finished_at || a.created_at || 0).getTime();
        const tb = new Date(b.finished_at || b.created_at || 0).getTime();
        return tb - ta;
      });

      setItems(enriched);
    } catch (err) {
      setError(err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { items, loading, error, reload };
}

export {
  filterExamResults,
  isExamResultCompleted,
  isExamResultPending,
  isTeacherExamAssignmentCurrent,
};
