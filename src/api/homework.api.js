import { apiFetch, getToken } from './http';

export const homework = {
  list() {
    return apiFetch('/homework');
  },
  get(id) {
    return apiFetch(`/homework/${encodeURIComponent(id)}`);
  },
  create(data) {
    return apiFetch('/homework', { method: 'POST', body: JSON.stringify(data) });
  },
  update(id, data) {
    return apiFetch(`/homework/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  delete(id) {
    return apiFetch(`/homework/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  publish(id) {
    return apiFetch(`/homework/${encodeURIComponent(id)}/publish`, { method: 'POST', body: '{}' });
  },
  assign(id, data) {
    return apiFetch(`/homework/${encodeURIComponent(id)}/assign`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  listAssignments(homeworkId) {
    const q = homeworkId ? `?homeworkId=${encodeURIComponent(homeworkId)}` : '';
    return apiFetch(`/homework/assignments${q}`);
  },
  myAssignments() {
    return apiFetch('/homework/assignments/mine');
  },
  assignmentResult(assignmentId) {
    return apiFetch(`/homework/assignments/${encodeURIComponent(assignmentId)}/result`);
  },
  start(assignmentId) {
    return apiFetch(`/homework/assignments/${encodeURIComponent(assignmentId)}/start`, {
      method: 'POST',
      body: '{}',
    });
  },
  getAttempt(attemptId) {
    return apiFetch(`/homework/attempts/${encodeURIComponent(attemptId)}`);
  },
  saveAnswers(attemptId, answers) {
    return apiFetch(`/homework/attempts/${encodeURIComponent(attemptId)}/answers`, {
      method: 'PATCH',
      body: JSON.stringify({ answers }),
    });
  },
  submit(attemptId, answers) {
    return apiFetch(`/homework/attempts/${encodeURIComponent(attemptId)}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers: answers || [] }),
    });
  },
  updateLocalStatus(assignmentId, data) {
    return apiFetch(`/homework/assignments/${encodeURIComponent(assignmentId)}/local-status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async uploadSpeakingAudio(attemptId, questionSnapshotId, file, durationMs) {
    const formData = new FormData();
    formData.append('file', file);
    if (durationMs != null) formData.append('duration_ms', String(durationMs));
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(
      `/api/homework/attempts/${encodeURIComponent(attemptId)}/questions/${encodeURIComponent(questionSnapshotId)}/audio`,
      { method: 'POST', headers, body: formData },
    );
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      throw new Error(
        (Array.isArray(data?.message) ? data.message.join(', ') : data?.message) ||
          data?.error ||
          'Не удалось загрузить аудио',
      );
    }
    return data;
  },

  saveReview(assignmentId, body) {
    return apiFetch(`/homework/assignments/${encodeURIComponent(assignmentId)}/review`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  finalizeReview(assignmentId) {
    return apiFetch(
      `/homework/assignments/${encodeURIComponent(assignmentId)}/review/finalize`,
      { method: 'POST', body: '{}' },
    );
  },
};
