import { apiFetch } from './http';

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
};
