import { apiFetch } from './http';
import { createDomainClient } from './domain-client';

const client = createDomainClient('/students');

export const students = {
  ...client,

  /**
   * Active students with lesson_balance <= 2 (server-filtered).
   * GET /students/low-balance
   */
  lowBalance() {
    return apiFetch('/students/low-balance');
  },

  /**
   * Students for the Payments picker (admin: all, teacher: assigned).
   * GET /students/payment-options
   */
  paymentOptions() {
    return apiFetch('/students/payment-options');
  },

  mergeCandidates({ primaryStudentId, search = '' } = {}) {
    const params = new URLSearchParams({ primaryStudentId });
    if (search.trim()) params.set('search', search.trim());
    return apiFetch(`/students/merge-candidates?${params.toString()}`);
  },

  merge(primaryStudentId, secondaryStudentId) {
    return apiFetch(`/students/${primaryStudentId}/merge`, {
      method: 'POST',
      body: JSON.stringify({ secondaryStudentId }),
    });
  },
};
