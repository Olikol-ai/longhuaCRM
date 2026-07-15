import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export type LessonTargetFields = {
  groupId?: string;
  primaryStudentId?: string;
  studentId?: string;
  lessonType?: 'individual' | 'group';
};

function resolvePrimaryStudentId(dto: LessonTargetFields): string | undefined {
  return dto.primaryStudentId || dto.studentId || undefined;
}

@ValidatorConstraint({ name: 'lessonHasTarget', async: false })
export class LessonHasTargetConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as LessonTargetFields;
    const primaryStudentId = resolvePrimaryStudentId(dto);
    if (dto.lessonType === 'group') {
      return Boolean(dto.groupId);
    }
    if (dto.lessonType === 'individual') {
      return Boolean(primaryStudentId);
    }
    return Boolean(dto.groupId || primaryStudentId);
  }

  defaultMessage(args: ValidationArguments): string {
    const dto = args.object as LessonTargetFields;
    if (dto.lessonType === 'group') {
      return 'Выберите группу для группового урока';
    }
    if (dto.lessonType === 'individual') {
      return 'Выберите ученика для индивидуального урока';
    }
    return 'Выберите ученика для индивидуального урока или группу для группового';
  }
}
