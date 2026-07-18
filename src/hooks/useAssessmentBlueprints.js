import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api';
import { unwrapItems } from '@/lib/assessment-ui';

/**
 * List blueprints; optionally enrich with section_rules count via detail fetch.
 */
export function useAssessmentBlueprints({ status } = {}) {
  const [blueprints, setBlueprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await api.assessment.listBlueprints({
        status: status || undefined,
        limit: 200,
      });
      const items = unwrapItems(payload);
      const enriched = await Promise.all(
        items.map(async (row) => {
          try {
            const detail = await api.assessment.getBlueprint(row.id);
            const rules = detail.section_rules || detail.sectionRules || [];
            return {
              ...row,
              ...detail,
              section_rules: rules,
              section_count: rules.length,
            };
          } catch {
            return { ...row, section_rules: [], section_count: 0 };
          }
        }),
      );
      setBlueprints(enriched);
    } catch (err) {
      setError(err);
      setBlueprints([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { blueprints, loading, error, reload };
}

export function useAssessmentBlueprint(blueprintId) {
  const [blueprint, setBlueprint] = useState(null);
  const [loading, setLoading] = useState(Boolean(blueprintId));
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!blueprintId) {
      setBlueprint(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const detail = await api.assessment.getBlueprint(blueprintId);
      setBlueprint(detail);
    } catch (err) {
      setError(err);
      setBlueprint(null);
    } finally {
      setLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { blueprint, loading, error, reload, setBlueprint };
}
