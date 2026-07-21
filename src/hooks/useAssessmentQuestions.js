import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api';
import { unwrapItems } from '@/lib/assessment-ui';

export function useAssessmentQuestions({ bankId, type, status, search } = {}) {
  const [questions, setQuestions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await api.assessment.listQuestions({
        bank_id: bankId || undefined,
        type: type || undefined,
        status: status || undefined,
        search: search || undefined,
        limit: 200,
      });
      const items = unwrapItems(payload);
      setQuestions(items);
      setTotal(Number(payload?.total ?? items.length) || items.length);
    } catch (err) {
      setError(err);
      setQuestions([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [bankId, type, status, search]);

  useEffect(() => {
    reload();
  }, [reload]);

  const removeQuestion = useCallback((questionId) => {
    setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    setTotal((prev) => Math.max(0, prev - 1));
  }, []);

  return { questions, total, loading, error, reload, removeQuestion };
}
