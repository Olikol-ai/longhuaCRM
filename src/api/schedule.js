import { apiFetch } from './http';

export const schedule = {
  getTeacherAvailability(teacherId) {
    return apiFetch(`/schedule/teachers/${teacherId}/availability`);
  },

  checkTeacherAvailability(teacherId, { date, start_time, duration }) {
    return apiFetch(`/schedule/teachers/${teacherId}/check-availability`, {
      method: 'POST',
      body: JSON.stringify({ date, start_time, duration }),
    });
  },
};
