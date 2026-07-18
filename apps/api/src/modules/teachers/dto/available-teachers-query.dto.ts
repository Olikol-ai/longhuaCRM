import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

/**
 * Query for GET /teachers/available.
 * startTime accepts HH:MM or HH:MM:SS.
 */
export class AvailableTeachersQueryDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @IsString()
  @Matches(/^\d{1,2}:\d{2}(:\d{2})?$/, { message: 'startTime must be HH:MM or HH:MM:SS' })
  startTime!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(480)
  duration?: number;
}
