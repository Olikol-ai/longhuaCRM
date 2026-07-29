import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TeacherStudentContactEntity } from '../teacher-student-contacts/entities/teacher-student-contact.entity';

export type LessonParticipantFields = {
  groupId?: string;
  primaryStudentId?: string;
  studentId?: string;
  primaryTutorStudentId?: string;
  tutorStudentId?: string;
  primaryTeacherStudentContactId?: string;
  teacherStudentContactId?: string;
  tutorId?: string;
  teacherId?: string;
  lessonType?: 'individual' | 'group';
};

export type LessonParticipantKind =
  | 'group'
  | 'crm_student'
  | 'contact'
  | 'tutor_student';

export type ResolvedLessonParticipant = {
  kind: LessonParticipantKind;
  groupId?: string;
  primaryStudentId?: string;
  primaryTutorStudentId?: string;
  primaryTeacherStudentContactId?: string;
};

export function resolvePrimaryStudentId(
  dto: LessonParticipantFields,
): string | undefined {
  return dto.primaryStudentId || dto.studentId || undefined;
}

export function resolvePrimaryTutorStudentId(
  dto: LessonParticipantFields,
): string | undefined {
  return dto.primaryTutorStudentId || dto.tutorStudentId || undefined;
}

export function resolveTeacherStudentContactId(
  dto: LessonParticipantFields,
): string | undefined {
  return dto.primaryTeacherStudentContactId || dto.teacherStudentContactId || undefined;
}

/**
 * Pure target resolution for lesson create/update validation.
 * Returns null when no valid single target is present (or targets are mixed).
 */
export function resolveLessonParticipant(
  dto: LessonParticipantFields,
): ResolvedLessonParticipant | null {
  const groupId = dto.groupId || undefined;
  const primaryStudentId = resolvePrimaryStudentId(dto);
  const primaryTutorStudentId = resolvePrimaryTutorStudentId(dto);
  const contactId = resolveTeacherStudentContactId(dto);

  if (dto.lessonType === 'group') {
    return groupId ? { kind: 'group', groupId } : null;
  }

  // Tutor-owned lessons: TutorStudent notebook OR private contact (not CRM student / group).
  if (dto.tutorId && !dto.teacherId) {
    if (groupId || primaryStudentId) return null;
    if (primaryTutorStudentId && contactId) return null;
    if (primaryTutorStudentId) {
      return { kind: 'tutor_student', primaryTutorStudentId };
    }
    if (contactId) {
      return { kind: 'contact', primaryTeacherStudentContactId: contactId };
    }
    return null;
  }

  if (dto.lessonType === 'individual') {
    if (primaryStudentId && contactId) return null;
    if (primaryStudentId && !primaryTutorStudentId) {
      return { kind: 'crm_student', primaryStudentId };
    }
    if (contactId && !primaryTutorStudentId) {
      return { kind: 'contact', primaryTeacherStudentContactId: contactId };
    }
    return null;
  }

  // Unspecified lessonType: exactly one target.
  if (groupId && !primaryStudentId && !primaryTutorStudentId && !contactId) {
    return { kind: 'group', groupId };
  }
  if (!groupId && primaryStudentId && !primaryTutorStudentId && !contactId) {
    return { kind: 'crm_student', primaryStudentId };
  }
  if (!groupId && !primaryStudentId && primaryTutorStudentId && !contactId) {
    return { kind: 'tutor_student', primaryTutorStudentId };
  }
  if (!groupId && !primaryStudentId && !primaryTutorStudentId && contactId) {
    return { kind: 'contact', primaryTeacherStudentContactId: contactId };
  }
  return null;
}

export function lessonParticipantMissingMessage(
  dto: LessonParticipantFields,
): string {
  if (dto.lessonType === 'group') {
    return 'Выберите группу для группового урока';
  }
  if (dto.tutorId && !dto.teacherId) {
    return 'Выберите ученика репетитора для индивидуального урока';
  }
  if (dto.lessonType === 'individual') {
    return 'Выберите ученика для индивидуального урока';
  }
  return 'Выберите ученика для индивидуального урока или группу для группового';
}

export function lessonParticipantConflictMessage(
  dto: LessonParticipantFields,
): string {
  if (dto.tutorId && !dto.teacherId) {
    return 'Выберите либо ученика блокнота, либо личного контакта, не обоих';
  }
  return 'Выберите либо ученика CRM, либо личного ученика, не обоих';
}

/** Whether DTO target fields are valid for class-validator (no throw). */
export function isValidLessonParticipant(dto: LessonParticipantFields): boolean {
  return resolveLessonParticipant(dto) !== null;
}

/**
 * Throws BadRequest when participant target is missing or mixed incorrectly.
 */
export function assertLessonParticipant(
  dto: LessonParticipantFields,
): ResolvedLessonParticipant {
  const primaryStudentId = resolvePrimaryStudentId(dto);
  const primaryTutorStudentId = resolvePrimaryTutorStudentId(dto);
  const contactId = resolveTeacherStudentContactId(dto);

  if (dto.tutorId && !dto.teacherId) {
    if (dto.lessonType === 'group' || dto.groupId) {
      throw new BadRequestException(
        'Групповые занятия доступны только преподавателям школы',
      );
    }
    if (primaryTutorStudentId && contactId) {
      throw new BadRequestException(lessonParticipantConflictMessage(dto));
    }
  } else if (primaryStudentId && contactId) {
    throw new BadRequestException(lessonParticipantConflictMessage(dto));
  }

  const resolved = resolveLessonParticipant(dto);
  if (!resolved) {
    throw new BadRequestException(lessonParticipantMissingMessage(dto));
  }
  return resolved;
}

/**
 * Contact must belong to the lesson instructor (teacher or tutor owner).
 */
export function assertContactOwnedByInstructor(
  contact: TeacherStudentContactEntity | null | undefined,
  instructor: { teacherId?: string; tutorId?: string },
): asserts contact is TeacherStudentContactEntity {
  if (!contact || contact.status === 'inactive') {
    throw new BadRequestException('Личный ученик не найден');
  }
  if (instructor.teacherId) {
    if (contact.ownerType !== 'teacher' || contact.ownerId !== instructor.teacherId) {
      throw new ForbiddenException(
        'Личный ученик не принадлежит выбранному преподавателю',
      );
    }
    return;
  }
  if (instructor.tutorId) {
    if (contact.ownerType !== 'tutor' || contact.ownerId !== instructor.tutorId) {
      throw new ForbiddenException(
        'Личный ученик не принадлежит выбранному репетитору',
      );
    }
    return;
  }
  throw new BadRequestException(
    'Укажите преподавателя (teacherId) или репетитора (tutorId)',
  );
}
