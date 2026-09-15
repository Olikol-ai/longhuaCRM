import { apiFetch } from './http';

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (typeof value === 'boolean') {
      query.set(key, value ? 'true' : 'false');
      return;
    }
    query.set(key, String(value));
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

export const balances = {
  /**
   * Admin school balances list + summary.
   * GET /admin/balances
   */
  list(params = {}) {
    return apiFetch(`/admin/balances${buildQuery(params)}`);
  },

  /**
   * Admin balance detail for one student.
   * GET /admin/balances/:studentId
   */
  detail(studentId) {
    return apiFetch(`/admin/balances/${encodeURIComponent(studentId)}`);
  },

  /**
   * Absolute lesson-balance correction with audit trail (no fake payment).
   * POST /admin/balances/:studentId/adjust-lessons
   */
  adjustLessons(studentId, body) {
    return apiFetch(`/admin/balances/${encodeURIComponent(studentId)}/adjust-lessons`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};
