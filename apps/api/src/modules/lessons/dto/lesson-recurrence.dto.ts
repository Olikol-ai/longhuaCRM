import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  Validate,
  ValidateIf,
} from 'class-validator';
import { IsRequiredText } from '../../../common/validators/is-required-text.decorator';
import { LessonFormat, LessonType } from '../entities/lesson.entity';
import { LessonHasInstructorConstraint } from './lesson-instructor.validator';
import { LessonHasTargetConstraint } from './lesson-target.validator';

function pickUuid(...candidates: unknown[]): string | undefined {
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

/** Create a rolling weekly recurrence series + initial horizon of lessons. */
export class CreateRecurringLessonDto {
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @IsOptional()
  @IsUUID()
  tutorId?: string;

  @IsOptional()
  @Transform(({ value, obj }) =>
    pickUuid(value, (obj as Record<string, unknown>).group_id),
  )
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @Transform(({ value, obj }) => {
    const record = obj as Record<string, unknown>;
    return pickUuid(
      value,
      record.primaryStudentId,
      record.studentId,
      record.student_id,
      record.primary_student_id,
    );
  })
  @IsUUID()
  primaryStudentId?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @Transform(({ value, obj }) => {
    const record = obj as Record<string, unknown>;
    return pickUuid(
      value,
      record.primaryTutorStudentId,
      record.tutorStudentId,
      record.tutor_student_id,
      record.primary_tutor_student_id,
    );
  })
  @IsUUID()
  primaryTutorStudentId?: string;

  @IsOptional()
  @IsUUID()
  tutorStudentId?: string;

  @IsOptional()
  @Transform(({ value, obj }) => {
    const record = obj as Record<string, unknown>;
    return pickUuid(
      value,
      record.primaryTeacherStudentContactId,
      record.teacherStudentContactId,
      record.teacher_student_contact_id,
      record.primary_teacher_student_contact_id,
    );
  })
  @IsUUID()
  primaryTeacherStudentContactId?: string;

  @IsOptional()
  @IsUUID()
  teacherStudentContactId?: string;

  @IsRequiredText()
  @Validate(LessonHasInstructorConstraint)
  @Validate(LessonHasTargetConstraint)
  date!: string;

  @IsRequiredText()
  startTime!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  duration?: number;

  @IsOptional()
  @IsEnum(['individual', 'group'])
  lessonType?: LessonType;

  @IsOptional()
  @IsEnum(['online', 'offline'])
  lessonFormat?: LessonFormat;

  @IsOptional()
  @IsString()
  meetingLink?: string;

  @IsOptional()
  @IsString()
  room?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Inclusive last date for the series; omit for open-ended. */
  @IsOptional()
  @Transform(({ value, obj }) => {
    const raw =
      value ??
      (obj as Record<string, unknown>).until_date ??
      (obj as Record<string, unknown>).untilDate;
    if (raw === '' || raw === null || raw === undefined) return undefined;
    return raw;
  })
  @ValidateIf((_, v) => v != null && v !== '')
  @IsDateString()
  untilDate?: string | null;
}

export type LessonRecurrenceApplyScope = 'this' | 'following' | 'all';

export class UpdateLessonRecurrenceDto {
  @IsOptional()
  @IsBoolean()
  weekly?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsDateString()
  untilDate?: string | null;

  /** Required when the lesson already belongs to a series (or when stopping one). */
  @IsOptional()
  @IsEnum(['this', 'following', 'all'])
  applyScope?: LessonRecurrenceApplyScope;
}
