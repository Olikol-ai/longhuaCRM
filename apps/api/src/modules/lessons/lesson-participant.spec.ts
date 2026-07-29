import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  assertContactOwnedByInstructor,
  assertLessonParticipant,
  isValidLessonParticipant,
  resolveLessonParticipant,
} from './lesson-participant';
import { TeacherStudentContactEntity } from '../teacher-student-contacts/entities/teacher-student-contact.entity';

const TEACHER_ID = '11111111-1111-4111-8111-111111111111';
const TUTOR_ID = '22222222-2222-4222-8222-222222222222';
const STUDENT_ID = '33333333-3333-4333-8333-333333333333';
const CONTACT_ID = '44444444-4444-4444-8444-444444444444';
const TUTOR_STUDENT_ID = '55555555-5555-4555-8555-555555555555';
const GROUP_ID = '66666666-6666-4666-8666-666666666666';

describe('lesson-participant', () => {
  describe('resolveLessonParticipant', () => {
    it('accepts CRM student for individual teacher lesson', () => {
      expect(
        resolveLessonParticipant({
          teacherId: TEACHER_ID,
          primaryStudentId: STUDENT_ID,
          lessonType: 'individual',
        }),
      ).toEqual({ kind: 'crm_student', primaryStudentId: STUDENT_ID });
    });

    it('accepts private contact for individual teacher lesson', () => {
      expect(
        resolveLessonParticipant({
          teacherId: TEACHER_ID,
          primaryTeacherStudentContactId: CONTACT_ID,
          lessonType: 'individual',
        }),
      ).toEqual({
        kind: 'contact',
        primaryTeacherStudentContactId: CONTACT_ID,
      });
    });

    it('rejects mixed CRM student and contact', () => {
      expect(
        resolveLessonParticipant({
          teacherId: TEACHER_ID,
          primaryStudentId: STUDENT_ID,
          primaryTeacherStudentContactId: CONTACT_ID,
          lessonType: 'individual',
        }),
      ).toBeNull();
    });

    it('accepts tutor private contact', () => {
      expect(
        resolveLessonParticipant({
          tutorId: TUTOR_ID,
          primaryTeacherStudentContactId: CONTACT_ID,
          lessonType: 'individual',
        }),
      ).toEqual({
        kind: 'contact',
        primaryTeacherStudentContactId: CONTACT_ID,
      });
    });

    it('accepts tutor student notebook entry', () => {
      expect(
        resolveLessonParticipant({
          tutorId: TUTOR_ID,
          primaryTutorStudentId: TUTOR_STUDENT_ID,
        }),
      ).toEqual({
        kind: 'tutor_student',
        primaryTutorStudentId: TUTOR_STUDENT_ID,
      });
    });

    it('accepts group', () => {
      expect(
        resolveLessonParticipant({
          teacherId: TEACHER_ID,
          groupId: GROUP_ID,
          lessonType: 'group',
        }),
      ).toEqual({ kind: 'group', groupId: GROUP_ID });
    });

    it('rejects empty individual target', () => {
      expect(
        resolveLessonParticipant({
          teacherId: TEACHER_ID,
          lessonType: 'individual',
        }),
      ).toBeNull();
    });
  });

  describe('assertLessonParticipant', () => {
    it('throws the shared missing-target message', () => {
      expect(() =>
        assertLessonParticipant({
          teacherId: TEACHER_ID,
          lessonType: 'individual',
        }),
      ).toThrow(BadRequestException);
      expect(() =>
        assertLessonParticipant({
          teacherId: TEACHER_ID,
          lessonType: 'individual',
        }),
      ).toThrow('Выберите ученика для индивидуального урока');
    });

    it('throws when both CRM student and contact are set', () => {
      expect(() =>
        assertLessonParticipant({
          teacherId: TEACHER_ID,
          primaryStudentId: STUDENT_ID,
          primaryTeacherStudentContactId: CONTACT_ID,
          lessonType: 'individual',
        }),
      ).toThrow('Выберите либо ученика CRM, либо личного ученика, не обоих');
    });

    it('isValidLessonParticipant mirrors resolve', () => {
      expect(
        isValidLessonParticipant({
          teacherId: TEACHER_ID,
          primaryTeacherStudentContactId: CONTACT_ID,
          lessonType: 'individual',
        }),
      ).toBe(true);
      expect(
        isValidLessonParticipant({
          teacherId: TEACHER_ID,
          lessonType: 'individual',
        }),
      ).toBe(false);
    });
  });

  describe('assertContactOwnedByInstructor', () => {
    const base = {
      id: CONTACT_ID,
      name: 'Local',
      phone: null,
      comment: null,
      lessonBalance: 0,
      linkedStudentId: null,
      status: 'active' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('allows teacher-owned contact', () => {
      const contact = {
        ...base,
        ownerType: 'teacher' as const,
        ownerId: TEACHER_ID,
      } as TeacherStudentContactEntity;
      expect(() =>
        assertContactOwnedByInstructor(contact, { teacherId: TEACHER_ID }),
      ).not.toThrow();
    });

    it('rejects contact owned by another teacher', () => {
      const contact = {
        ...base,
        ownerType: 'teacher' as const,
        ownerId: '99999999-9999-4999-8999-999999999999',
      } as TeacherStudentContactEntity;
      expect(() =>
        assertContactOwnedByInstructor(contact, { teacherId: TEACHER_ID }),
      ).toThrow(ForbiddenException);
    });

    it('allows tutor-owned contact', () => {
      const contact = {
        ...base,
        ownerType: 'tutor' as const,
        ownerId: TUTOR_ID,
      } as TeacherStudentContactEntity;
      expect(() =>
        assertContactOwnedByInstructor(contact, { tutorId: TUTOR_ID }),
      ).not.toThrow();
    });

    it('rejects missing contact', () => {
      expect(() =>
        assertContactOwnedByInstructor(null, { teacherId: TEACHER_ID }),
      ).toThrow(BadRequestException);
    });
  });
});
