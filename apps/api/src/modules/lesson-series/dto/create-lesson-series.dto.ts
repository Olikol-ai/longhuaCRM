import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  LessonSeriesFormat,
  LessonSeriesFrequency,
  LessonSeriesStatus,
} from '../entities/lesson-series.entity';
import { LessonSeriesSlotDto } from './lesson-series-slot.dto';

export class CreateLessonSeriesDto {
  @IsUUID()
  courseId!: string;

  @IsUUID()
  groupId!: string;

  @IsUUID()
  teacherId!: string;

  @IsString()
  startDate!: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LessonSeriesSlotDto)
  slots?: LessonSeriesSlotDto[];

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
