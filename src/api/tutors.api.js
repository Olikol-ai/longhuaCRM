import { createDomainClient } from './domain-client';
import { apiFetch } from './http';

const client = createDomainClient('/tutors');

export const tutors = {
  ...client,

  get(id) {
    return apiFetch(`/tutors/${encodeURIComponent(id)}`);
  },

  me() {
    return apiFetch('/tutors/me');
  },

  myStats() {
    return apiFetch('/tutors/me/stats');
  },

  myStudents() {
    return apiFetch('/tutors/me/students');
  },

  createMyStudent(payload) {
    return apiFetch('/tutors/me/students', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateMyStudent(id, payload) {
    return apiFetch(`/tutors/me/students/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteMyStudent(id) {
    return apiFetch(`/tutors/me/students/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  students(id) {
    return apiFetch(`/tutors/${id}/students`);
  },

  createStudent(tutorId, payload) {
    return apiFetch(`/tutors/${encodeURIComponent(tutorId)}/students`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateStudent(tutorId, studentId, payload) {
    return apiFetch(
      `/tutors/${encodeURIComponent(tutorId)}/students/${encodeURIComponent(studentId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    );
  },

  deleteStudent(tutorId, studentId) {
    return apiFetch(
      `/tutors/${encodeURIComponent(tutorId)}/students/${encodeURIComponent(studentId)}`,
      {
        method: 'DELETE',
      },
    );
  },

  lessons(id) {
    return apiFetch(`/tutors/${encodeURIComponent(id)}/lessons`);
  },

  materials(tutorId) {
    return apiFetch(`/tutors/${encodeURIComponent(tutorId)}/materials`);
  },

  createMaterial(tutorId, payload) {
    return apiFetch(`/tutors/${encodeURIComponent(tutorId)}/materials`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateMaterial(tutorId, materialId, payload) {
    return apiFetch(
      `/tutors/${encodeURIComponent(tutorId)}/materials/${encodeURIComponent(materialId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    );
  },

  deleteMaterial(tutorId, materialId) {
    return apiFetch(
      `/tutors/${encodeURIComponent(tutorId)}/materials/${encodeURIComponent(materialId)}`,
      {
        method: 'DELETE',
      },
    );
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
