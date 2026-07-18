import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api';
import { unwrapItems } from '@/lib/assessment-ui';
import { displayPersonName } from '@/lib/assessment-admin';

export function useAssessmentResults({
  examId,
  studentId,
  status,
  from,
  to,
} = {}) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        exam_id: examId || undefined,
        student_id: studentId || undefined,
        from: from || undefined,
        to: to || undefined,
        limit: 200,
      };

      if (status === 'passed') params.passed = true;
      if (status === 'failed') params.passed = false;

      const [resultsPayload, examsPayload, attemptsPayload, studentsPayload] =
        await Promise.all([
          api.assessment.listResults(params),
          api.assessment.listExams({ limit: 200 }),
          api.assessment.listAttempts({
            exam_id: examId || undefined,
            student_id: studentId || undefined,
            limit: 200,
          }),
          api.students.list().catch(() => []),
        ]);

      const examName = new Map(
        unwrapItems(examsPayload).map((e) => [e.id, e.name]),
      );
      const students = Array.isArray(studentsPayload)
        ? studentsPayload
        : unwrapItems(studentsPayload);
      const studentName = new Map(students.map((s) => [s.id, displayPersonName(s)]));
      const attemptById = new Map(
        unwrapItems(attemptsPayload).map((a) => [a.id, a]),
      );

      let items = unwrapItems(resultsPayload).map((row) => {
        const attempt = attemptById.get(row.attempt_id);
        const sid = attempt?.student_id;
        return {
          ...row,
          exam_name: examName.get(row.exam_id) || 'Экзамен',
          student_id: sid || null,
          student_name: sid ? studentName.get(sid) || sid : '—',
        };
      });

      if (status === 'pending_review') {
        items = items.filter(
          (r) => r.status === 'pending_review' || r.status === 'processing',
        );
      } else if (status === 'failed') {
        items = items.filter((r) => r.status === 'failed');
      } else if (status === 'passed') {
        items = items.filter((r) => r.status === 'passed' || r.passed === true);
      } else if (status) {
        items = items.filter((r) => r.status === status);
      }

      items.sort((a, b) => {
        const ta = new Date(a.finished_at || a.created_at || 0).getTime();
        const tb = new Date(b.finished_at || b.created_at || 0).getTime();
        return tb - ta;
      });

      setResults(items);
    } catch (err) {
      setError(err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [examId, studentId, status, from, to]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { results, loading, error, reload };
}

export function useAssessmentResultDetail(resultId) {
  const [result, setResult] = useState(null);
  const [exam, setExam] = useState(null);
  const [studentName, setStudentName] = useState('—');
  const [loading, setLoading] = useState(Boolean(resultId));
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!resultId) {
      setResult(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let detail = await api.assessment.getResult(resultId);
      // Prefer attempt alias — loads breakdowns
      if (detail?.attempt_id) {
        try {
          const withBreakdown = await api.assessment.getResultByAttempt(
            detail.attempt_id,
          );
          detail = { ...detail, ...withBreakdown };
        } catch {
          /* keep base detail */
        }
      }

      setResult(detail);

      const [examDetail, attempt, students] = await Promise.all([
        api.assessment.getExam(detail.exam_id).catch(() => null),
        api.assessment
          .listAttempts({ exam_id: detail.exam_id, limit: 200 })
          .then((p) =>
            unwrapItems(p).find((a) => a.id === detail.attempt_id),
          )
          .catch(() => null),
        api.students.list().catch(() => []),
      ]);

      setExam(examDetail);

      const list = Array.isArray(students) ? students : unwrapItems(students);
      const sid = attempt?.student_id;
      const student = list.find((s) => s.id === sid);
      setStudentName(sid ? displayPersonName(student) || sid : '—');
    } catch (err) {
      setError(err);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [resultId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { result, exam, studentName, loading, error, reload };
}
