import { apiFetch } from './http';
import { createDomainClient } from './domain-client';

const client = createDomainClient('/teacher-payments');

export const teacherPayments = {
  ...client,
  my() {
    return apiFetch('/teacher-payments/my');
  },
};
