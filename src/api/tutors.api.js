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

  myStudents() {
    return apiFetch('/tutors/me/students');
  },

  students(id) {
    return apiFetch(`/tutors/${id}/students`);
  },

  allStudents() {
    return apiFetch('/tutors/students/all');
  },

  stats(id) {
    return apiFetch(`/tutors/${id}/stats`);
  },

  analyticsOverview() {
    return apiFetch('/tutors/analytics/overview');
  },
};
