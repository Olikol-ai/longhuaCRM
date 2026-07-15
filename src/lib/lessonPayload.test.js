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
});
