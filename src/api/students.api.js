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
};
