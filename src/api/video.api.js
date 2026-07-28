import { apiFetch } from './http';

export const video = {
  getLessonAccess(lessonId) {
    return apiFetch(`/video/lessons/${encodeURIComponent(lessonId)}`);
  },
};
