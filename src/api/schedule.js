import { apiFetch } from './http';
import { createDomainClient } from './domain-client';

const slots = createDomainClient('/schedule');

function normalizeTeacherSchedule(data) {
  if (!data || typeof data !== 'object') {
    return { hasSchedule: false, slots: [] };
  }
  const hasSchedule = Boolean(data.has_schedule ?? data.hasSchedule);
  const rawSlots = Array.isArray(data.slots) ? data.slots : [];
  return {
    hasSchedule,
    slots: rawSlots.map((slot) => ({
      day: Number(slot.day ?? slot.day_of_week ?? 0),
      from: String(slot.from ?? slot.time_from ?? '').slice(0, 5),
      to: String(slot.to ?? slot.time_to ?? '').slice(0, 5),
    })),
  };
}

export const schedule = {
  ...slots,
  slots,

  async getTeacherAvailability(teacherId) {
    const data = await apiFetch(`/schedule/teachers/${teacherId}/availability`);
    return normalizeTeacherSchedule(data);
  },

  checkTeacherAvailability(teacherId, { date, start_time, duration }) {
    return apiFetch(`/schedule/teachers/${teacherId}/check-availability`, {
      method: 'POST',
      body: JSON.stringify({ date, start_time, duration }),
    }).then((data) => {
      if (!data || typeof data !== 'object') return data;
      return {
        ...data,
        available: Boolean(data.available),
        hasSchedule: Boolean(data.has_schedule ?? data.hasSchedule),
        message: data.message,
        slotsForDay: Array.isArray(data.slots_for_day)
          ? data.slots_for_day
          : Array.isArray(data.slotsForDay)
            ? data.slotsForDay
            : [],
      };
    });
  },

  /**
   * Atomic replace — POST (proxies/Cloudflare can stall PUT).
   */
  async replaceTeacherAvailability(teacherId, flatSlots) {
    const data = await apiFetch(`/schedule/teachers/${teacherId}/availability/replace`, {
      method: 'POST',
      body: JSON.stringify({
        slots: (flatSlots || []).map((slot) => ({
          day: Number(slot.day),
          from: String(slot.from),
          to: String(slot.to),
        })),
      }),
    });
    return normalizeTeacherSchedule(data);
  },

  filterBookings(query) {
    return apiFetch('/schedule/bookings/filter', {
      method: 'POST',
      body: JSON.stringify({ where: query }),
    });
  },
};
