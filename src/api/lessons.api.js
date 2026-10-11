import { apiFetch } from './http';
import { createDomainClient } from './domain-client';
import { toLessonWritePayload } from '../lib/lessonPayload';

export { toLessonWritePayload } from '../lib/lessonPayload';

const lessonsClient = createDomainClient('/lessons');
const attendance = {
  ...createDomainClient('/lessons/attendance', {
    listPath: '/lessons/attendance',
    filterPath: '/lessons/attendance/filter',
  }),
  present(id) {
    return apiFetch(`/lessons/attendance/${encodeURIComponent(id)}/present`, {
      method: 'PATCH',
      body: '{}',
    });
  },
  absent(id) {
    return apiFetch(`/lessons/attendance/${encodeURIComponent(id)}/absent`, {
      method: 'PATCH',
      body: '{}',
    });
  },
  late(id) {
    return apiFetch(`/lessons/attendance/${encodeURIComponent(id)}/late`, {
      method: 'PATCH',
      body: '{}',
    });
  },
  excused(id) {
    return apiFetch(`/lessons/attendance/${encodeURIComponent(id)}/excused`, {
      method: 'PATCH',
      body: '{}',
    });
  },
};

export const lessons = {
  ...lessonsClient,
  create(data) {
    return apiFetch('/lessons', {
      method: 'POST',
      body: JSON.stringify(toLessonWritePayload(data)),
    });
  },
  /** Weekly rolling series: creates template + ~12 weeks of planned lessons. */
  createRecurring(data) {
    return apiFetch('/lessons/recurring', {
      method: 'POST',
      body: JSON.stringify(toLessonWritePayload(data)),
    });
  },
  update(id, data) {
    return apiFetch(`/lessons/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(toLessonWritePayload(data)),
    });
  },
  /**
   * Delete a lesson.
   * - apply_scope `this` (default) | `all` | `series` | `following` — series scopes via DELETE /:id
   * - apply_scope `future` — this + later planned of THIS series (DELETE /:id/future)
   * - apply_scope `series` — all planned of THIS series (DELETE /:id/series)
   */
  delete(id, options = {}) {
    const scope =
      options.apply_scope ?? options.applyScope ?? null;
    if (scope === 'future') {
      return apiFetch(`/lessons/${encodeURIComponent(id)}/future`, {
        method: 'DELETE',
      });
    }
    if (scope === 'series') {
      return apiFetch(`/lessons/${encodeURIComponent(id)}/series`, {
        method: 'DELETE',
      });
    }
    const params = new URLSearchParams();
    if (scope && scope !== 'this') {
      params.set('apply_scope', String(scope));
    }
    const qs = params.toString();
    return apiFetch(
      `/lessons/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}`,
      { method: 'DELETE' },
    );
  },

  /** Preview count for DELETE /lessons/:id/future (no mutation). */
  previewFutureDelete(id) {
    return apiFetch(`/lessons/${encodeURIComponent(id)}/future`);
  },

  /** Preview count for DELETE /lessons/:id/series (no mutation). */
  previewSeriesDelete(id) {
    return apiFetch(`/lessons/${encodeURIComponent(id)}/series`);
  },
  updateStudents(id, data) {
    return apiFetch(`/lessons/${id}/students`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  listStudentChanges(id) {
    return apiFetch(`/lessons/${id}/student-changes`);
  },
  attendance,
};
