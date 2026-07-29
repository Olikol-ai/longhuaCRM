import { TEACHER_LESSON_UPDATE_FIELDS } from './domain-access.types';

describe('TEACHER_LESSON_UPDATE_FIELDS (student reassignment ACL)', () => {
  it('does not allow changing student target fields via general PATCH', () => {
    const fields: Set<string> = new Set(TEACHER_LESSON_UPDATE_FIELDS);
    expect(fields.has('primaryStudentId')).toBe(false);
    expect(fields.has('studentId')).toBe(false);
    expect(fields.has('primaryTutorStudentId')).toBe(false);
    expect(fields.has('tutorStudentId')).toBe(false);
    expect(fields.has('primaryTeacherStudentContactId')).toBe(false);
    expect(fields.has('teacherStudentContactId')).toBe(false);
  });

  it('still allows schedule / status fields for teachers', () => {
    const fields: Set<string> = new Set(TEACHER_LESSON_UPDATE_FIELDS);
    expect(fields.has('date')).toBe(true);
    expect(fields.has('startTime')).toBe(true);
    expect(fields.has('status')).toBe(true);
  });
});
