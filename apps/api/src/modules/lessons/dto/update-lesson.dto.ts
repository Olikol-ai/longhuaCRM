import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { LessonFormat, LessonStatus, LessonType } from '../entities/lesson.entity';

export class UpdateLessonDto {
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @IsOptional()
  @IsUUID()
  seriesId?: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsUUID()
  primaryStudentId?: string;

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
  reminder24hSent?: boolean;

  @IsOptional()
  reminder2hSent?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
