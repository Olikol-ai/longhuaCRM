import { apiFetch } from './http';
import { createDomainClient, recordToEntityPayload } from './domain-client';

const client = createDomainClient('/lesson-series');

export const lessonSeries = {
  ...client,
  create(data) {
    const payload = recordToEntityPayload(data);
    if (payload.courseTemplateId && !payload.courseId) {
      payload.courseId = payload.courseTemplateId;
      delete payload.courseTemplateId;
    }
    if (Array.isArray(data.slots)) {
      payload.slots = data.slots.map((slot) => ({
        dayOfWeek: slot.day_of_week ?? slot.dayOfWeek,
        startTime: slot.start_time ?? slot.startTime,
        endTime: slot.end_time ?? slot.endTime,
      }));
    }
    return apiFetch('/lesson-series', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
