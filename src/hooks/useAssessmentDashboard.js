import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api';
import { unwrapItems } from '@/lib/assessment-ui';

/**
 * Admin Assessment dashboard metrics.
 */
export function useAssessmentDashboard() {
  const [stats, setStats] = useState({
    questions: 0,
    exams: 0,
    activeAssignments: 0,
  });
  const [recentResults, setRecentResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [questions, exams, assignments, results] = await Promise.all([
        api.assessment.listQuestions({ limit: 1 }),
        api.assessment.listExams({ limit: 1 }),
        api.assessment.listAssignments({ active: true, limit: 1 }),
        api.assessment.listResults({ limit: 8 }),
      ]);

      setStats({
        questions: Number(questions?.total ?? unwrapItems(questions).length) || 0,
        exams: Number(exams?.total ?? unwrapItems(exams).length) || 0,
        activeAssignments:
          Number(assignments?.total ?? unwrapItems(assignments).length) || 0,
      });

      const items = unwrapItems(results);
      setRecentResults(
        [...items].sort((a, b) => {
          const ta = new Date(a.created_at || a.updated_at || 0).getTime();
          const tb = new Date(b.created_at || b.updated_at || 0).getTime();
          return tb - ta;
        }),
      );
    } catch (err) {
      setError(err);
      setRecentResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { stats, recentResults, loading, error, reload };
}
