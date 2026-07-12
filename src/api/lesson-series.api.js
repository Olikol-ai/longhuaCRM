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
    return apiFetch('/lesson-series', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
