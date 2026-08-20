import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';
import { LessonFormat, LessonStatus, LessonType } from '../entities/lesson.entity';
import { LessonRecurrenceApplyScope } from './lesson-recurrence.dto';

function pickUuid(...candidates: unknown[]): string | undefined {
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

export class UpdateLessonDto {
  @IsOptional()
  @IsUUID()
  teacherId?: string;

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

  /** Legacy alias for individual lesson student. */
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

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  startTime?: string;

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

  /**
   * When completing a lesson (status → completed), choose attendance outcome
   * for enrolled records. Not persisted on the lesson row.
   */
  @IsOptional()
  @Transform(({ value, obj }) => {
    const raw =
      value ??
      (obj as Record<string, unknown>).completion_attendance ??
      (obj as Record<string, unknown>).completionAttendance;
    return raw;
  })
  @IsEnum(['attended', 'missed'])
  completionAttendance?: 'attended' | 'missed';

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

  /** Enable / disable weekly recurrence when updating a lesson. */
  @IsOptional()
  @Transform(({ value, obj }) => {
    const raw =
      value ??
      (obj as Record<string, unknown>).recurrence_weekly ??
      (obj as Record<string, unknown>).recurrenceWeekly;
    if (raw === undefined || raw === null || raw === '') return undefined;
    return Boolean(raw);
  })
  @IsBoolean()
  recurrenceWeekly?: boolean;

  @IsOptional()
  @Transform(({ value, obj }) => {
    const raw =
      value ??
      (obj as Record<string, unknown>).recurrence_until ??
      (obj as Record<string, unknown>).recurrenceUntil;
    if (raw === '' || raw === null) return null;
    return raw;
  })
  @ValidateIf((_, v) => v != null && v !== '')
  @IsDateString()
  recurrenceUntil?: string | null;

  @IsOptional()
  @Transform(({ value, obj }) => {
    return (
      value ??
      (obj as Record<string, unknown>).apply_scope ??
      (obj as Record<string, unknown>).applyScope
    );
  })
  @IsEnum(['this', 'following', 'all', 'series'])
  applyScope?: LessonRecurrenceApplyScope;
}
