import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api';
import { unwrapItems } from '@/lib/assessment-ui';

export function useAssessmentBanks({ status, search } = {}) {
  const [banks, setBanks] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await api.assessment.listBanks({
        status: status || undefined,
        search: search || undefined,
        limit: 200,
      });
      const items = unwrapItems(payload);
      setBanks(items);
      setTotal(Number(payload?.total ?? items.length) || items.length);
    } catch (err) {
      setError(err);
      setBanks([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { banks, total, loading, error, reload };
}
