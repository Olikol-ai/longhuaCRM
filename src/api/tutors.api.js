import { createDomainClient } from './domain-client';
import { apiFetch } from './http';

const client = createDomainClient('/tutors');

export const tutors = {
  ...client,

  me() {
    return apiFetch('/tutors/me');
  },

  myStats() {
    return apiFetch('/tutors/me/stats');
  },

  stats(id) {
    return apiFetch(`/tutors/${id}/stats`);
  },
};
