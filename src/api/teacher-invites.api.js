import { apiFetch } from './http';

export const teacherInvites = {
  create(label) {
    return apiFetch('/teacher-invites', {
      method: 'POST',
      body: JSON.stringify(label ? { label } : {}),
    });
  },
  list() {
    return apiFetch('/teacher-invites');
  },
  revoke(id) {
    return apiFetch(`/teacher-invites/${id}/revoke`, { method: 'POST', body: '{}' });
  },
};
