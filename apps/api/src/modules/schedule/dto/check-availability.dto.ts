import { IsInt, IsOptional, IsString, IsUUID } from 'class-validator';

export class CheckAvailabilityDto {
  @IsString()
  date!: string;

  @IsOptional()
  @IsString()
  start_time?: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsInt()
  duration?: number;

  /** When editing a lesson, exclude it so it does not conflict with itself. */
  @IsOptional()
  @IsUUID()
  excludeLessonId?: string;

  @IsOptional()
  @IsUUID()
  exclude_lesson_id?: string;
}
