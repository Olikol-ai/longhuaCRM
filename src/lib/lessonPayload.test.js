import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toLessonWritePayload } from './lessonPayload.js';

describe('toLessonWritePayload', () => {
  it('maps student_id to primaryStudentId (not studentId)', () => {
    const payload = toLessonWritePayload({
      teacher_id: '11111111-1111-4111-8111-111111111111',
      student_id: '22222222-2222-4222-8222-222222222222',
      date: '2026-08-01',
      start_time: '10:00',
      duration: 60,
      student_name: 'Test',
      teacher_name: 'Teacher',
    });

    assert.equal(payload.primaryStudentId, '22222222-2222-4222-8222-222222222222');
    assert.equal(payload.teacherId, '11111111-1111-4111-8111-111111111111');
    assert.equal(payload.startTime, '10:00');
    assert.equal(payload.lessonType, 'individual');
    assert.equal(payload.studentId, undefined);
    assert.equal(payload.studentName, undefined);
    assert.equal(payload.teacherName, undefined);
  });

  it('maps primary_student_id and keeps group lessons group-only', () => {
    const individual = toLessonWritePayload({
      teacher_id: '11111111-1111-4111-8111-111111111111',
      primary_student_id: '33333333-3333-4333-8333-333333333333',
      date: '2026-08-01',
      start_time: '11:00',
    });
    assert.equal(individual.primaryStudentId, '33333333-3333-4333-8333-333333333333');

    const group = toLessonWritePayload({
      teacher_id: '11111111-1111-4111-8111-111111111111',
      group_id: '44444444-4444-4444-8444-444444444444',
      student_id: '33333333-3333-4333-8333-333333333333',
      date: '2026-08-01',
      start_time: '12:00',
      lesson_type: 'group',
    });
    assert.equal(group.groupId, '44444444-4444-4444-8444-444444444444');
    assert.equal(group.lessonType, 'group');
    assert.equal(group.primaryStudentId, undefined);
  });

  it('maps tutor_student_id for tutor-owned lessons', () => {
    const payload = toLessonWritePayload({
      tutor_id: '55555555-5555-4555-8555-555555555555',
      tutor_student_id: '66666666-6666-4666-8666-666666666666',
      student_id: '77777777-7777-4777-8777-777777777777',
      date: '2026-08-01',
      start_time: '10:00',
    });
    assert.equal(payload.tutorId, '55555555-5555-4555-8555-555555555555');
    assert.equal(payload.primaryTutorStudentId, '66666666-6666-4666-8666-666666666666');
    assert.equal(payload.primaryStudentId, undefined);
    assert.equal(payload.tutorStudentId, undefined);
    assert.equal(payload.lessonType, 'individual');
  });

  it('maps teacher_student_contact_id and clears CRM student', () => {
    const payload = toLessonWritePayload({
      teacher_id: '11111111-1111-4111-8111-111111111111',
      teacher_student_contact_id: '88888888-8888-4888-8888-888888888888',
      student_id: '77777777-7777-4777-8777-777777777777',
      date: '2026-08-01',
      start_time: '10:00',
    });
    assert.equal(
      payload.primaryTeacherStudentContactId,
      '88888888-8888-4888-8888-888888888888',
    );
    assert.equal(payload.primaryStudentId, undefined);
    assert.equal(payload.teacherStudentContactId, undefined);
    assert.equal(payload.lessonType, 'individual');
  });

  it('keeps recurrence edit fields for Nest UpdateLessonDto', () => {
    const payload = toLessonWritePayload({
      teacher_id: '11111111-1111-4111-8111-111111111111',
      primary_student_id: '22222222-2222-4222-8222-222222222222',
      date: '2026-08-01',
      start_time: '18:00',
      recurrence_weekly: true,
      recurrence_until: '2026-12-01',
      apply_scope: 'following',
      is_recurring: true,
      recurrence_series_id: '99999999-9999-4999-8999-999999999999',
    });
    assert.equal(payload.recurrenceWeekly, true);
    assert.equal(payload.recurrenceUntil, '2026-12-01');
    assert.equal(payload.applyScope, 'following');
    assert.equal(payload.isRecurring, undefined);
    assert.equal(payload.recurrenceSeriesId, undefined);
  });
});
