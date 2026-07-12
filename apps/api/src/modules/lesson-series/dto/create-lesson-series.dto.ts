import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import {
  LessonSeriesFormat,
  LessonSeriesFrequency,
  LessonSeriesStatus,
} from '../entities/lesson-series.entity';

export class CreateLessonSeriesDto {
  @IsUUID()
  courseId!: string;

  @IsUUID()
  groupId!: string;

  @IsUUID()
  teacherId!: string;

  @IsString()
  startDate!: string;

  @IsString()
  startTime!: string;

  @IsOptional()
  @IsEnum(['weekly', 'biweekly'])
  frequency?: LessonSeriesFrequency;

  @IsInt()
  @Min(1)
  totalLessons!: number;

  @IsOptional()
  @IsEnum(['active', 'paused', 'stopped'])
  status?: LessonSeriesStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;

  @IsOptional()
  @IsEnum(['online', 'offline'])
  lessonFormat?: LessonSeriesFormat;

  @IsOptional()
  @IsString()
  meetingLink?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
