import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api';
import { unwrapItems } from '@/lib/assessment-ui';

export function useAssessmentExams({ status, search } = {}) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const examsPayload = await api.assessment.listExams({
        status: status || undefined,
        search: search || undefined,
        limit: 200,
      });
      setExams(unwrapItems(examsPayload));
    } catch (err) {
      setError(err);
      setExams([]);
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { exams, loading, error, reload };
}

export function useAssessmentExamDetail(examId) {
  const [exam, setExam] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(Boolean(examId));
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!examId) {
      setExam(null);
      setPreview(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [detail, previewPayload] = await Promise.all([
        api.assessment.getExam(examId),
        api.assessment.previewExam(examId).catch(() => null),
      ]);
      setExam(detail);
      setPreview(previewPayload);
    } catch (err) {
      setError(err);
      setExam(null);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { exam, preview, loading, error, reload, setExam };
}
