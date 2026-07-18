import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api';
import { unwrapItems } from '@/lib/assessment-ui';

export function useAssessmentExamTemplates({ status, search } = {}) {
  const [templates, setTemplates] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await api.assessment.listExamTemplates({
        status: status || undefined,
        search: search || undefined,
        limit: 200,
      });
      const items = unwrapItems(payload);
      setTemplates(items);
      setTotal(Number(payload?.total ?? items.length) || items.length);
    } catch (err) {
      setError(err);
      setTemplates([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { templates, total, loading, error, reload };
}
