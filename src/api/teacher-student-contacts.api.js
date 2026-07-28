import { apiFetch } from './http';

/**
 * Private local student contacts for teachers/tutors (scheduling notebook).
 * Never creates User / CRM Student / balance / payment.
 */
export const teacherStudentContacts = {
  listMine(params = {}) {
    const qs = new URLSearchParams();
    if (params.ownerType) qs.set('ownerType', params.ownerType);
    const suffix = qs.toString() ? `?${qs}` : '';
    return apiFetch(`/teacher-student-contacts/me${suffix}`);
  },

  createMine(payload, params = {}) {
    const qs = new URLSearchParams();
    if (params.ownerType) qs.set('ownerType', params.ownerType);
    const suffix = qs.toString() ? `?${qs}` : '';
    return apiFetch(`/teacher-student-contacts/me${suffix}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  listForOwner(ownerType, ownerId) {
    return apiFetch(
      `/teacher-student-contacts/${encodeURIComponent(ownerType)}/${encodeURIComponent(ownerId)}`,
    );
  },

  createForOwner(ownerType, ownerId, payload) {
    return apiFetch(
      `/teacher-student-contacts/${encodeURIComponent(ownerType)}/${encodeURIComponent(ownerId)}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  },

  update(id, payload) {
    return apiFetch(`/teacher-student-contacts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  remove(id) {
    return apiFetch(`/teacher-student-contacts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};
