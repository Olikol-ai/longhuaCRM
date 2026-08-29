import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api';
import { userFacingError } from '@/lib/userFacingError';

/**
 * Loads student-visible exam feedback for a result the caller owns.
 */
export function useStudentExamFeedback(resultId) {
  const [result, setResult] = useState(null);
  const [examTitle, setExamTitle] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(Boolean(resultId));
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!resultId) {
      setResult(null);
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const bundle = await api.assessment.getResultFeedback(resultId);
      setResult(bundle?.result || null);
      setItems(Array.isArray(bundle?.items) ? bundle.items : []);
      const examId = bundle?.result?.exam_id;
      if (examId) {
        const exam = await api.assessment.getExam(examId).catch(() => null);
        setExamTitle(exam?.name || 'Экзамен');
      } else {
        setExamTitle('Экзамен');
      }
    } catch (err) {
      setError(
        Object.assign(new Error(userFacingError(err, 'Не удалось загрузить разбор')), {
          cause: err,
        }),
      );
      setResult(null);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [resultId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { result, examTitle, items, loading, error, reload };
}
