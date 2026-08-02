import { apiFetch } from './http';

export const examAcademy = {
  catalog: {
    programs: () => apiFetch('/exam-academy/catalog/programs'),
    versions: (program) =>
      apiFetch(`/exam-academy/catalog/versions${program ? `?program=${encodeURIComponent(program)}` : ''}`),
    levels: (version) =>
      apiFetch(`/exam-academy/catalog/levels?version=${encodeURIComponent(version || 'hsk_2_0')}`),
    sections: (levelId) =>
      apiFetch(`/exam-academy/catalog/levels/${encodeURIComponent(levelId)}/sections`),
    blueprints: (levelId) =>
      apiFetch(`/exam-academy/catalog/levels/${encodeURIComponent(levelId)}/blueprints`),
    itemTypes: () => apiFetch('/exam-academy/catalog/item-types'),
  },
  sessions: {
    list: () => apiFetch('/exam-academy/sessions'),
    create: (payload) =>
      apiFetch('/exam-academy/sessions', { method: 'POST', body: JSON.stringify(payload) }),
    get: (id) => apiFetch(`/exam-academy/sessions/${encodeURIComponent(id)}`),
    start: (id) =>
      apiFetch(`/exam-academy/sessions/${encodeURIComponent(id)}/start`, { method: 'POST' }),
    runtime: (id) => apiFetch(`/exam-academy/sessions/${encodeURIComponent(id)}/runtime`),
    saveAnswers: (id, answers) =>
      apiFetch(`/exam-academy/sessions/${encodeURIComponent(id)}/answers`, {
        method: 'PATCH',
        body: JSON.stringify({ answers }),
      }),
    submit: (id) =>
      apiFetch(`/exam-academy/sessions/${encodeURIComponent(id)}/submit`, { method: 'POST' }),
    result: (id) => apiFetch(`/exam-academy/sessions/${encodeURIComponent(id)}/result`),
  },
  me: {
    preparation: () => apiFetch('/exam-academy/me/preparation'),
    favorites: () => apiFetch('/exam-academy/me/favorites'),
    addFavorite: (payload) =>
      apiFetch('/exam-academy/me/favorites', { method: 'POST', body: JSON.stringify(payload) }),
    removeFavorite: (id) =>
      apiFetch(`/exam-academy/me/favorites/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    review: () => apiFetch('/exam-academy/me/review'),
    dictionary: (status) =>
      apiFetch(`/exam-academy/me/dictionary${status ? `?status=${encodeURIComponent(status)}` : ''}`),
    addWord: (payload) =>
      apiFetch('/exam-academy/me/dictionary', { method: 'POST', body: JSON.stringify(payload) }),
    updateWord: (id, payload) =>
      apiFetch(`/exam-academy/me/dictionary/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    deleteWord: (id) =>
      apiFetch(`/exam-academy/me/dictionary/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    statsSeries: () => apiFetch('/exam-academy/me/stats/series'),
  },
};
