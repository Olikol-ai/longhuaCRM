import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class LessonSeriesSlotDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsString()
  startTime!: string;

  @IsOptional()
  @IsString()
  endTime?: string;
}
