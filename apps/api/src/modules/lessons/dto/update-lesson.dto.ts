import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { LessonFormat, LessonStatus, LessonType } from '../entities/lesson.entity';

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
}
