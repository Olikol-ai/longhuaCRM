import { apiFetch } from './http';
import { createDomainClient } from './domain-client';
import { toLessonWritePayload } from '../lib/lessonPayload';

export { toLessonWritePayload } from '../lib/lessonPayload';

const lessonsClient = createDomainClient('/lessons');
const attendance = {
  ...createDomainClient('/lessons/attendance', {
    listPath: '/lessons/attendance',
    filterPath: '/lessons/attendance/filter',
  }),
  present(id) {
    return apiFetch(`/lessons/attendance/${encodeURIComponent(id)}/present`, {
      method: 'PATCH',
      body: '{}',
    });
  },
  absent(id) {
    return apiFetch(`/lessons/attendance/${encodeURIComponent(id)}/absent`, {
      method: 'PATCH',
      body: '{}',
    });
  },
  late(id) {
    return apiFetch(`/lessons/attendance/${encodeURIComponent(id)}/late`, {
      method: 'PATCH',
      body: '{}',
    });
  },
  excused(id) {
    return apiFetch(`/lessons/attendance/${encodeURIComponent(id)}/excused`, {
      method: 'PATCH',
      body: '{}',
    });
  },
};

export const lessons = {
  ...lessonsClient,
  create(data) {
    return apiFetch('/lessons', {
      method: 'POST',
      body: JSON.stringify(toLessonWritePayload(data)),
    });
  },
  update(id, data) {
    return apiFetch(`/lessons/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(toLessonWritePayload(data)),
    });
  },
  updateStudents(id, data) {
    return apiFetch(`/lessons/${id}/students`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  listStudentChanges(id) {
    return apiFetch(`/lessons/${id}/student-changes`);
  },
  attendance,
};
