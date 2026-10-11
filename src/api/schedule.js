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

function normalizeClockInterval(slot) {
  if (!slot || typeof slot !== 'object') return null;
  const from = String(slot.from ?? slot.time_from ?? '').slice(0, 5);
  const to = String(slot.to ?? slot.time_to ?? '').slice(0, 5);
  if (!from || !to) return null;
  return { from, to };
}

function normalizeConflict(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    lessonId: raw.lesson_id ?? raw.lessonId ?? null,
    date: raw.date ?? null,
    startTime: String(raw.start_time ?? raw.startTime ?? '').slice(0, 5),
    endTime: String(raw.end_time ?? raw.endTime ?? '').slice(0, 5),
    duration: Number(raw.duration) || 0,
    lessonType: raw.lesson_type ?? raw.lessonType ?? '',
    participantLabel: raw.participant_label ?? raw.participantLabel ?? '',
    summary: raw.summary ?? '',
  };
}

function normalizeAvailabilityCheck(data) {
  if (!data || typeof data !== 'object') return data;
  const occupied = Boolean(data.occupied);
  const status =
    data.status
    || (occupied ? 'busy' : data.available === false ? 'outside_availability' : 'free');
  return {
    ...data,
    available: Boolean(data.available),
    hasSchedule: Boolean(data.has_schedule ?? data.hasSchedule),
    message: data.message,
    occupied,
    status,
    conflict: normalizeConflict(data.conflict),
    slotsForDay: Array.isArray(data.slots_for_day)
      ? data.slots_for_day
      : Array.isArray(data.slotsForDay)
        ? data.slotsForDay
        : [],
  };
}

function normalizeFreeSchedule(data) {
  if (!data || typeof data !== 'object') {
    return { from: '', to: '', teachers: [] };
  }
  const teachers = Array.isArray(data.teachers) ? data.teachers : [];
  return {
    from: data.from ?? '',
    to: data.to ?? '',
    teachers: teachers.map((row) => ({
      teacherId: row.teacher_id ?? row.teacherId,
      teacherName: row.teacher_name ?? row.teacherName ?? '',
      hasSchedule: Boolean(row.has_schedule ?? row.hasSchedule),
      days: (Array.isArray(row.days) ? row.days : []).map((day) => ({
        date: day.date,
        weekday: Number(day.weekday ?? 0),
        availability: (day.availability || []).map(normalizeClockInterval).filter(Boolean),
        busy: (day.busy || []).map(normalizeClockInterval).filter(Boolean),
        free: (day.free || []).map(normalizeClockInterval).filter(Boolean),
      })),
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

  checkTeacherAvailability(teacherId, { date, start_time, duration, exclude_lesson_id, excludeLessonId }) {
    const exclude = excludeLessonId ?? exclude_lesson_id ?? undefined;
    return apiFetch(`/schedule/teachers/${teacherId}/check-availability`, {
      method: 'POST',
      body: JSON.stringify({
        date,
        start_time,
        duration,
        ...(exclude ? { exclude_lesson_id: exclude } : {}),
      }),
    }).then(normalizeAvailabilityCheck);
  },

  /**
   * Free intervals = declared weekly availability − occupying lessons.
   * @param {{ from: string, to: string, teacherId?: string }} params
   */
  async getFreeSchedule({ from, to, teacherId } = {}) {
    const query = new URLSearchParams();
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    if (teacherId) query.set('teacherId', teacherId);
    const data = await apiFetch(`/schedule/free-schedule?${query.toString()}`);
    return normalizeFreeSchedule(data);
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
