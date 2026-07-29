import { ForbiddenException } from '@nestjs/common';
import { normalizeRole } from '../../common/constants/roles';

/**
 * Pure ACL decision helpers for tutor materials — kept separate from Nest DI
 * so unit tests do not need a database.
 */
export function assertTutorCanManageMaterial(actor: {
  sub: string;
  role: string;
}, material: { createdByUserId: string | null }): void {
  if (normalizeRole(actor.role) === 'admin') {
    return;
  }
  if (normalizeRole(actor.role) !== 'tutor') {
    throw new ForbiddenException('Недостаточно прав для изменения материала');
  }
  if (material.createdByUserId !== actor.sub) {
    throw new ForbiddenException('Можно изменять только свои материалы');
  }
}

export function assertTeacherCannotGrantTutorStudent(
  actorRole: string,
  targetType: string,
): void {
  if (normalizeRole(actorRole) === 'admin') {
    return;
  }
  if (normalizeRole(actorRole) === 'teacher' && targetType === 'tutor_student') {
    throw new ForbiddenException(
      'Преподаватель не может выдавать материалы ученикам репетитора',
    );
  }
}

export function assertTutorCannotGrantSchoolStudent(
  actorRole: string,
  targetType: string,
): void {
  if (normalizeRole(actorRole) !== 'tutor') {
    return;
  }
  if (targetType === 'student' || targetType === 'group' || targetType === 'course') {
    throw new ForbiddenException(
      'Репетитор может выдавать доступ только своим ученикам',
    );
  }
}

export function tutorOwnsTutorStudent(
  tutorId: string,
  tutorStudent: { tutorId: string } | null,
): boolean {
  return Boolean(tutorStudent && tutorStudent.tutorId === tutorId);
}
