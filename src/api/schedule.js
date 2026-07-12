import { apiFetch } from './http';
import { createDomainClient, recordToEntityPayload } from './domain-client';

const slots = createDomainClient('/schedule');

export const schedule = {
  ...slots,
  slots,

  getTeacherAvailability(teacherId) {
    return apiFetch(`/schedule/teachers/${teacherId}/availability`);
  },

  checkTeacherAvailability(teacherId, { date, start_time, duration }) {
    return apiFetch(`/schedule/teachers/${teacherId}/check-availability`, {
      method: 'POST',
      body: JSON.stringify({ date, start_time, duration }),
    });
  },

  async replaceTeacherAvailability(teacherId, flatSlots) {
    const existing = await slots.filter({ teacher_id: teacherId });
    await Promise.all(existing.map((row) => slots.delete(row.id)));

    const created = await Promise.all(
      flatSlots.map((slot) =>
        slots.create({
          teacher_id: teacherId,
          day_of_week: slot.day,
          time_from: slot.from,
          time_to: slot.to,
        }),
      ),
    );

    return created;
  },

  filterBookings(query) {
    return apiFetch('/schedule/bookings/filter', {
      method: 'POST',
      body: JSON.stringify({ where: query }),
    });
  },
};
