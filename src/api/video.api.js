import { apiFetch } from './http';

export const video = {
  getLessonAccess(lessonId) {
    return apiFetch(`/video/lessons/${encodeURIComponent(lessonId)}`);
  },
  refreshToken(lessonId) {
    return apiFetch(`/video/lessons/${encodeURIComponent(lessonId)}/token`, {
      method: 'POST',
      body: '{}',
    });
  },
  getParticipants(lessonId) {
    return apiFetch(`/video/lessons/${encodeURIComponent(lessonId)}/participants`);
  },
  ensureLessonChat(lessonId) {
    return apiFetch(`/video/lessons/${encodeURIComponent(lessonId)}/chat`, {
      method: 'POST',
      body: '{}',
    });
  },
};
