import { apiFetch } from './http';

function withQuery(path, filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value != null && value !== '') params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export const b2b = {
  dashboard(filters = {}) {
    return apiFetch(withQuery('/b2b/dashboard', filters));
  },
  organizations: {
    list: () => apiFetch('/b2b/organizations'),
    get: (id) => apiFetch(`/b2b/organizations/${id}`),
    create: (body) => apiFetch('/b2b/organizations', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => apiFetch(`/b2b/organizations/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    remove: (id) => apiFetch(`/b2b/organizations/${id}`, { method: 'DELETE' }),
  },
  receipts: {
    list: (filters = {}) => apiFetch(withQuery('/b2b/receipts', filters)),
    create: (body) => apiFetch('/b2b/receipts', { method: 'POST', body: JSON.stringify(body) }),
  },
  commissions: {
    accruals: (managerUserId) => {
      const qs = managerUserId ? `?managerUserId=${encodeURIComponent(managerUserId)}` : '';
      return apiFetch(`/b2b/commissions/accruals${qs}`);
    },
    summary: (managerUserId) => apiFetch(`/b2b/commissions/summary/${managerUserId}`),
    createPayout: (body) => apiFetch('/b2b/commissions/payouts', { method: 'POST', body: JSON.stringify(body) }),
  },
  managers: {
    getProfile: (userId) => apiFetch(`/b2b/managers/${userId}/profile`),
    updateProfile: (userId, body) => apiFetch(`/b2b/managers/${userId}/profile`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  },
  groupCounterparty: (groupId) => apiFetch(`/b2b/groups/${groupId}/counterparty`),
  diary: {
    summary: (managerUserId) => {
      const qs = managerUserId ? `?managerUserId=${encodeURIComponent(managerUserId)}` : '';
      return apiFetch(`/b2b/diary/summary${qs}`);
    },
    listEntries: (filters = {}) => apiFetch(withQuery('/b2b/diary/entries', filters)),
    getEntry: (id) => apiFetch(`/b2b/diary/entries/${id}`),
    createEntry: (body) => apiFetch('/b2b/diary/entries', { method: 'POST', body: JSON.stringify(body) }),
    bulkCreateEntries: (body) => apiFetch('/b2b/diary/entries/bulk', { method: 'POST', body: JSON.stringify(body) }),
    updateEntry: (id, body) => apiFetch(`/b2b/diary/entries/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    reassignEntry: (id, body) => apiFetch(`/b2b/diary/entries/${id}/reassign`, { method: 'PATCH', body: JSON.stringify(body) }),
    removeEntry: (id) => apiFetch(`/b2b/diary/entries/${id}`, { method: 'DELETE' }),
    addNote: (id, body) => apiFetch(`/b2b/diary/entries/${id}/notes`, { method: 'POST', body: JSON.stringify(body) }),
    listNotes: (id) => apiFetch(`/b2b/diary/entries/${id}/notes`),
    addContact: (id, body) => apiFetch(`/b2b/diary/entries/${id}/contacts`, { method: 'POST', body: JSON.stringify(body) }),
    listContacts: (id) => apiFetch(`/b2b/diary/entries/${id}/contacts`),
    createDeal: (id, body) => apiFetch(`/b2b/diary/entries/${id}/deals`, { method: 'POST', body: JSON.stringify(body) }),
    updateDeal: (id, body) => apiFetch(`/b2b/diary/deals/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  },
};
