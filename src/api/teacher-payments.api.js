import { apiFetch } from './http';

/**
 * Teacher payments client — monthly salary summary only for admin UI.
 * Intentionally does NOT expose CRUD list/filter/update against /teacher-payments
 * (per-lesson TeacherPayment rows are audit history on the backend).
 */
export const teacherPayments = {
  my() {
    return apiFetch('/teacher-payments/my');
  },
  myPeriods() {
    return apiFetch('/teacher-payments/my/periods');
  },
  summary(month) {
    const q = new URLSearchParams({ month: String(month) });
    return apiFetch(`/teacher-payments/summary?${q.toString()}`);
  },
  summaryDetails(month, teacherId) {
    const q = new URLSearchParams({
      month: String(month),
      teacherId: String(teacherId),
    });
    return apiFetch(`/teacher-payments/summary/details?${q.toString()}`);
  },
  markMonthPaid({ teacherId, month, amount }) {
    return apiFetch('/teacher-payments/summary/pay', {
      method: 'POST',
      body: JSON.stringify({
        teacherId,
        month,
        ...(amount != null ? { amount } : {}),
      }),
    });
  },
};
