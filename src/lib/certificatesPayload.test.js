import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Mirrors src/api/certificates.api.js → toCertificatePayload (kept self-contained).
 */
function omitBlank(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return typeof value === 'string' ? value.trim() : value;
}

function toCertificatePayload(input = {}) {
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
  };
  delete payload.courseTemplateId;
  const clean = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) clean[key] = value;
  }
  return clean;
}

describe('certificates payload mapping', () => {
  it('maps course_id to courseId and never courseTemplateId', () => {
    const payload = toCertificatePayload({
      student_id: 's1',
      course_id: 'c1',
      registration_number: 'REG-1',
      blank_series: 'LH',
      blank_number: '001',
      issue_date: '2026-07-01',
      status: 'draft',
    });
    assert.equal(payload.courseId, 'c1');
    assert.equal(payload.courseTemplateId, undefined);
    assert.equal(payload.studentId, 's1');
    assert.equal(payload.registrationNumber, 'REG-1');
    assert.equal(payload.issueDate, '2026-07-01');
  });

  it('omits empty optional strings so DTO IsOptional works', () => {
    const payload = toCertificatePayload({
      student_id: 's1',
      course_id: 'c1',
      registration_number: 'REG-2',
      blank_series: '',
      blank_number: '  ',
      issue_date: '',
      status: 'draft',
    });
    assert.equal(payload.blankSeries, undefined);
    assert.equal(payload.blankNumber, undefined);
    assert.equal(payload.issueDate, undefined);
    assert.equal(payload.status, 'draft');
  });
});
