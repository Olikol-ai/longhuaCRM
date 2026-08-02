import {
  canAccessHskAcademy,
  canManageHskAcademyContent,
  HSK_ACADEMY_ROLES,
  HSK_ACADEMY_STAFF_ROLES,
} from './roles';

describe('HSK Academy school-only roles', () => {
  it('allows only Longhua school roles into Academy', () => {
    expect(HSK_ACADEMY_ROLES).toEqual(['admin', 'teacher', 'student']);
    expect(canAccessHskAcademy('admin')).toBe(true);
    expect(canAccessHskAcademy('teacher')).toBe(true);
    expect(canAccessHskAcademy('student')).toBe(true);
    expect(canAccessHskAcademy('tutor')).toBe(false);
    expect(canAccessHskAcademy('tutor_student')).toBe(false);
    expect(canAccessHskAcademy('pending')).toBe(false);
    expect(canAccessHskAcademy(null)).toBe(false);
  });

  it('allows only school staff into Exam Content Studio', () => {
    expect(HSK_ACADEMY_STAFF_ROLES).toEqual(['admin', 'teacher']);
    expect(canManageHskAcademyContent('admin')).toBe(true);
    expect(canManageHskAcademyContent('teacher')).toBe(true);
    expect(canManageHskAcademyContent('student')).toBe(false);
    expect(canManageHskAcademyContent('tutor')).toBe(false);
    expect(canManageHskAcademyContent('tutor_student')).toBe(false);
  });
});
