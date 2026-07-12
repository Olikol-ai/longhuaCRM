import { createDomainClient } from './domain-client';
import { apiFetch } from './http';

const templates = createDomainClient('/courses');
const enrollments = createDomainClient('/courses/enrollments', {
  listPath: '/courses/enrollments',
  filterPath: '/courses/enrollments/filter',
});

export const courses = {
  ...templates,
  templates,
  enrollments,
  enrollmentProgress(enrollmentId) {
    return apiFetch(`/courses/enrollments/${enrollmentId}/progress`);
  },
};
