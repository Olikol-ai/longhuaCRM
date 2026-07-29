import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import {
  isValidLessonParticipant,
  lessonParticipantMissingMessage,
  LessonParticipantFields,
} from '../lesson-participant';

@ValidatorConstraint({ name: 'lessonHasTarget', async: false })
export class LessonHasTargetConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as LessonParticipantFields;
    return isValidLessonParticipant(dto);
  }

  defaultMessage(args: ValidationArguments): string {
    const dto = args.object as LessonParticipantFields;
    return lessonParticipantMissingMessage(dto);
  }
}
