import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  Validate,
} from 'class-validator';
import { IsRequiredText } from '../../../common/validators/is-required-text.decorator';
import { LessonFormat, LessonStatus, LessonType } from '../entities/lesson.entity';
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

export class CreateLessonDto {
  /**
   * School teacher owner. Mutually exclusive with tutorId.
   */
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  /** External tutor owner. Mutually exclusive with teacherId. */
  @IsOptional()
  @IsUUID()
  tutorId?: string;

  @IsOptional()
  @IsUUID()
  seriesId?: string;

  @IsOptional()
  @Transform(({ value, obj }) =>
    pickUuid(value, (obj as Record<string, unknown>).group_id),
  )
  @IsUUID()
  groupId?: string;

  /**
   * Canonical field for individual lessons.
   * Also filled from legacy studentId / student_id aliases.
   */
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

  /** Legacy alias kept so whitelist does not drop the field before transform. */
  @IsOptional()
  @IsUUID()
  studentId?: string;

  /** Isolated tutor pupil for tutor-owned lessons. */
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

  /**
   * Always present — host for object-level validators that must not be skipped
   * by @IsOptional on instructor fields.
   */
  @IsRequiredText()
  @Validate(LessonHasInstructorConstraint)
  @Validate(LessonHasTargetConstraint)
  date!: string;

  @IsRequiredText()
  startTime!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;

  @IsOptional()
  @IsEnum([
    'planned',
    'completed',
    'cancelled',
    'rescheduled',
    'missed',
    'missed_no_notice',
  ])
  status?: LessonStatus;

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
}
