import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export type LessonInstructorFields = {
  teacherId?: string;
  tutorId?: string;
};

function hasId(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * A lesson is owned by exactly one instructor type:
 * school teacher (teacherId) OR external tutor (tutorId).
 */
@ValidatorConstraint({ name: 'lessonHasInstructor', async: false })
export class LessonHasInstructorConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as LessonInstructorFields;
    const hasTeacher = hasId(dto.teacherId);
    const hasTutor = hasId(dto.tutorId);
    return (hasTeacher && !hasTutor) || (!hasTeacher && hasTutor);
  }

  defaultMessage(): string {
    return 'Укажите преподавателя (teacherId) или репетитора (tutorId), но не обоих';
  }
}
