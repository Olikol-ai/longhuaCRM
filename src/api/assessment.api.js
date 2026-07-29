import { apiFetch, getToken } from './http';

function toQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

async function apiFormFetch(path, formData, { method = 'POST' } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { method, headers, body: formData });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg =
      (Array.isArray(data?.message) ? data.message.join(', ') : data?.message) ||
      data?.error ||
      'Не удалось выполнить запрос. Попробуйте ещё раз.';
    const err = new Error(typeof msg === 'string' ? msg : 'Не удалось выполнить запрос. Попробуйте ещё раз.');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/**
 * Assessment API — /api/assessment/*
 * Responses are snake_case (ApiSerializeInterceptor).
 */
export const assessment = {
  // ── Questions ──────────────────────────────────────────────────────────
  listQuestions(params) {
    return apiFetch(`/assessment/questions${toQuery(params)}`);
  },

  getQuestion(questionId) {
    return apiFetch(`/assessment/questions/${questionId}`);
  },

  createQuestion(body) {
    return apiFetch('/assessment/questions', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  updateQuestion(questionId, body) {
    return apiFetch(`/assessment/questions/${questionId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  deleteQuestion(questionId) {
    return apiFetch(`/assessment/questions/${questionId}`, { method: 'DELETE' });
  },

  publishQuestion(questionId) {
    return apiFetch(`/assessment/questions/${questionId}/publish`, { method: 'POST' });
  },

  archiveQuestion(questionId) {
    return apiFetch(`/assessment/questions/${questionId}/archive`, { method: 'POST' });
  },

  uploadQuestionAttachment(questionId, { file, kind }) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('kind', kind);
    return apiFormFetch(`/assessment/questions/${questionId}/attachments`, formData);
  },

  deleteQuestionAttachment(questionId, attachmentId) {
    return apiFetch(`/assessment/questions/${questionId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    });
  },

  // ── Exam blocks ────────────────────────────────────────────────────────
  listExamBlocks(params) {
    return apiFetch(`/assessment/blocks${toQuery(params)}`);
  },

  getExamBlock(blockId) {
    return apiFetch(`/assessment/blocks/${blockId}`);
  },

  createExamBlock(body) {
    return apiFetch('/assessment/blocks', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  updateExamBlock(blockId, body) {
    return apiFetch(`/assessment/blocks/${blockId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  deleteExamBlock(blockId) {
    return apiFetch(`/assessment/blocks/${blockId}`, { method: 'DELETE' });
  },

  publishExamBlock(blockId) {
    return apiFetch(`/assessment/blocks/${blockId}/publish`, { method: 'POST' });
  },

  archiveExamBlock(blockId) {
    return apiFetch(`/assessment/blocks/${blockId}/archive`, { method: 'POST' });
  },

  // ── Assignments / Exams / Attempts / Results (shared) ──────────────────
  listAssignments(params) {
    return apiFetch(`/assessment/assignments${toQuery(params)}`);
  },

  getAssignment(assignmentId) {
    return apiFetch(`/assessment/assignments/${assignmentId}`);
  },

  listExams(params) {
    return apiFetch(`/assessment/exams${toQuery(params)}`);
  },

  getExam(examId) {
    return apiFetch(`/assessment/exams/${examId}`);
  },

  createExam(body) {
    return apiFetch('/assessment/exams', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  updateExam(examId, body) {
    return apiFetch(`/assessment/exams/${examId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  deleteExam(examId) {
    return apiFetch(`/assessment/exams/${examId}`, { method: 'DELETE' });
  },

  publishExam(examId) {
    return apiFetch(`/assessment/exams/${examId}/publish`, { method: 'POST' });
  },

  archiveExam(examId) {
    return apiFetch(`/assessment/exams/${examId}/archive`, { method: 'POST' });
  },

  previewExam(examId) {
    return apiFetch(`/assessment/exams/${examId}/preview`);
  },

  // ── Assignments ────────────────────────────────────────────────────────
  createAssignment(body) {
    return apiFetch('/assessment/assignments', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  cancelAssignment(assignmentId) {
    return apiFetch(`/assessment/assignments/${assignmentId}/cancel`, {
      method: 'POST',
    });
  },

  listAttempts(params) {
    return apiFetch(`/assessment/attempts${toQuery(params)}`);
  },

  startAttempt({ exam_id, assignment_id }) {
    return apiFetch('/assessment/attempts', {
      method: 'POST',
      body: JSON.stringify({
        exam_id,
        ...(assignment_id ? { assignment_id } : {}),
      }),
    });
  },

  getAttemptState(attemptId) {
    return apiFetch(`/assessment/attempts/${attemptId}`);
  },

  getAttemptSnapshots(attemptId) {
    return apiFetch(`/assessment/attempts/${attemptId}/snapshots`);
  },

  autosaveAnswers(attemptId, answers) {
    return apiFetch(`/assessment/attempts/${attemptId}/answers`, {
      method: 'PATCH',
      body: JSON.stringify({ answers }),
    });
  },

  submitAttempt(attemptId, answers) {
    return apiFetch(`/assessment/attempts/${attemptId}/submit`, {
      method: 'POST',
      body: JSON.stringify(answers ? { answers } : {}),
    });
  },

  getResultByAttempt(attemptId) {
    return apiFetch(`/assessment/attempts/${attemptId}/result`);
  },

  getResult(resultId) {
    return apiFetch(`/assessment/results/${resultId}`);
  },

  listResults(params) {
    return apiFetch(`/assessment/results${toQuery(params)}`);
  },

  getResultReview(resultId) {
    return apiFetch(`/assessment/results/${resultId}/review`);
  },

  saveResultReview(resultId, body) {
    return apiFetch(`/assessment/results/${resultId}/review`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  finalizeResultReview(resultId) {
    return apiFetch(`/assessment/results/${resultId}/review/finalize`, {
      method: 'POST',
    });
  },

  downloadAttachmentUrl(attachmentId, disposition = 'inline') {
    return `/api/assessment/attachments/${attachmentId}/download${toQuery({ disposition })}`;
  },
};
