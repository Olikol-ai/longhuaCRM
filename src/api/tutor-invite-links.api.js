import { apiFetch } from './http';

export const tutorInviteLinks = {
  create(label) {
    return apiFetch('/tutor-invite-links', {
      method: 'POST',
      body: JSON.stringify(label ? { label } : {}),
    });
  },
  list() {
    return apiFetch('/tutor-invite-links');
  },
  revoke(id) {
    return apiFetch(`/tutor-invite-links/${id}/revoke`, { method: 'POST', body: '{}' });
  },
};
