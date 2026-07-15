import { apiFetch } from './http';
import { createDomainClient } from './domain-client';

/**
 * Certificates use course_id → courseId (entity field),
 * NOT the generic course_id → courseTemplateId alias used by enrollments.
 *
 * Payload is built explicitly so a wrong courseTemplateId can never be sent.
 */
function omitBlank(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return typeof value === 'string' ? value.trim() : value;
}

export function toCertificatePayload(input = {}) {
  const payload = {
    studentId: omitBlank(input.student_id ?? input.studentId),
    courseId: omitBlank(input.course_id ?? input.courseId),
    registrationNumber: omitBlank(
      input.registration_number ?? input.registrationNumber,
    ),
    blankSeries: omitBlank(input.blank_series ?? input.blankSeries),
    blankNumber: omitBlank(input.blank_number ?? input.blankNumber),
    issueDate: omitBlank(input.issue_date ?? input.issueDate),
    status: omitBlank(input.status),
    recipientSignature: omitBlank(
      input.recipient_signature ?? input.recipientSignature,
    ),
  };

  // Never allow the enrollment alias to leak in.
  delete payload.courseTemplateId;

  const clean = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) {
      clean[key] = value;
    }
  }
  return clean;
}

const listClient = createDomainClient('/certificates', {
  fieldAliases: {
    course_id: 'courseId',
  },
});

export const certificates = {
  list(sortField, limit) {
    return listClient.list(sortField, limit);
  },

  filter(query) {
    return listClient.filter(query);
  },

  create(data) {
    return apiFetch('/certificates', {
      method: 'POST',
      body: JSON.stringify(toCertificatePayload(data)),
    });
  },

  update(id, data) {
    return apiFetch(`/certificates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(toCertificatePayload(data)),
    });
  },

  delete(id) {
    return apiFetch(`/certificates/${id}`, { method: 'DELETE' });
  },

  get(id) {
    return apiFetch(`/certificates/${id}`);
  },

  /** Public authenticity check (no login required — used by QR landing page). */
  verify(id) {
    return apiFetch(`/certificates/${id}/verify`);
  },

  pdfUrl(id) {
    return `/api/certificates/${id}/pdf`;
  },

  async downloadPdf(id) {
    const { getToken } = await import('./http');
    const token = getToken();
    const res = await fetch(`/api/certificates/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const text = await res.text();
      let message = 'Не удалось скачать PDF';
      try {
        const data = JSON.parse(text);
        message = data.message || data.error || message;
      } catch {
        /* ignore */
      }
      const err = new Error(message);
      err.status = res.status;
      throw err;
    }
    return res.blob();
  },
};
