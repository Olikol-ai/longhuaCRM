import { ForbiddenException } from '@nestjs/common';
import {
  assertTeacherCannotGrantTutorStudent,
  assertTutorCanManageMaterial,
  assertTutorCannotGrantSchoolStudent,
  tutorOwnsTutorStudent,
} from './tutor-materials-acl.util';

describe('tutor-materials-acl.util', () => {
  it('allows tutor to manage own material', () => {
    expect(() =>
      assertTutorCanManageMaterial(
        { sub: 'u1', role: 'tutor' },
        { createdByUserId: 'u1' },
      ),
    ).not.toThrow();
  });

  it('forbids tutor from managing another author material', () => {
    expect(() =>
      assertTutorCanManageMaterial(
        { sub: 'u1', role: 'tutor' },
        { createdByUserId: 'u2' },
      ),
    ).toThrow(ForbiddenException);
  });

  it('forbids teacher from granting tutor_student target', () => {
    expect(() =>
      assertTeacherCannotGrantTutorStudent('teacher', 'tutor_student'),
    ).toThrow(ForbiddenException);
  });

  it('forbids tutor from granting school student/group/course', () => {
    expect(() => assertTutorCannotGrantSchoolStudent('tutor', 'student')).toThrow(
      ForbiddenException,
    );
    expect(() => assertTutorCannotGrantSchoolStudent('tutor', 'group')).toThrow(
      ForbiddenException,
    );
  });

  it('checks tutor owns tutor_student row', () => {
    expect(tutorOwnsTutorStudent('t1', { tutorId: 't1' })).toBe(true);
    expect(tutorOwnsTutorStudent('t1', { tutorId: 't2' })).toBe(false);
    expect(tutorOwnsTutorStudent('t1', null)).toBe(false);
  });
});
