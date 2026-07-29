import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api';
import { unwrapItems } from '@/lib/assessment-ui';

export function useAssessmentExamBlocks({ status } = {}) {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await api.assessment.listExamBlocks({
        status: status || undefined,
        limit: 200,
      });
      setBlocks(unwrapItems(payload));
    } catch (err) {
      setError(err);
      setBlocks([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { blocks, loading, error, reload };
}

export function useAssessmentExamBlock(blockId) {
  const [block, setBlock] = useState(null);
  const [loading, setLoading] = useState(Boolean(blockId));
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!blockId) {
      setBlock(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const detail = await api.assessment.getExamBlock(blockId);
      setBlock(detail);
    } catch (err) {
      setError(err);
      setBlock(null);
    } finally {
      setLoading(false);
    }
  }, [blockId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { block, loading, error, reload, setBlock };
}
