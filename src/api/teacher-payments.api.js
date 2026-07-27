import { apiFetch } from './http';
import { createDomainClient } from './domain-client';

const client = createDomainClient('/teacher-payments');

export const teacherPayments = {
  ...client,
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
