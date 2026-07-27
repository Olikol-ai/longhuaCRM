import { apiFetch } from './http';
import { createDomainClient } from './domain-client';

const client = createDomainClient('/teachers');

export const teachers = {
  ...client,

  /** Canonical active teachers (linked active User with role=teacher). */
  listActive() {
    return apiFetch('/teachers/active');
  },

  /**
   * Advisory list of teachers free for the given lesson slot.
   * @param {{ date: string, start_time: string, duration?: number }} params
   */
  getAvailable({ date, start_time, duration }) {
    const query = new URLSearchParams();
    query.set('date', date);
    query.set('startTime', start_time);
    if (duration != null && duration !== '') {
      query.set('duration', String(duration));
    }
    return apiFetch(`/teachers/available?${query.toString()}`);
  },
};
