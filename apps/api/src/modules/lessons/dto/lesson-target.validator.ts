import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export type LessonTargetFields = {
  groupId?: string;
  primaryStudentId?: string;
  studentId?: string;
  primaryTutorStudentId?: string;
  tutorStudentId?: string;
  tutorId?: string;
  teacherId?: string;
  lessonType?: 'individual' | 'group';
};

function resolvePrimaryStudentId(dto: LessonTargetFields): string | undefined {
  return dto.primaryStudentId || dto.studentId || undefined;
}

function resolvePrimaryTutorStudentId(dto: LessonTargetFields): string | undefined {
  return dto.primaryTutorStudentId || dto.tutorStudentId || undefined;
}

@ValidatorConstraint({ name: 'lessonHasTarget', async: false })
export class LessonHasTargetConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as LessonTargetFields;
    const primaryStudentId = resolvePrimaryStudentId(dto);
    const primaryTutorStudentId = resolvePrimaryTutorStudentId(dto);
    if (dto.lessonType === 'group') {
      return Boolean(dto.groupId);
    }
    if (dto.tutorId && !dto.teacherId) {
      return Boolean(primaryTutorStudentId);
    }
    if (dto.lessonType === 'individual') {
      return Boolean(primaryStudentId);
    }
    return Boolean(dto.groupId || primaryStudentId || primaryTutorStudentId);
  }

  defaultMessage(args: ValidationArguments): string {
    const dto = args.object as LessonTargetFields;
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
}
