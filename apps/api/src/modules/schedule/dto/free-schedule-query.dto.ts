import { IsOptional, IsString, Matches } from 'class-validator';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Query for GET /schedule/free-schedule.
 * Dates are inclusive calendar days in school timezone (YYYY-MM-DD).
 */
export class FreeScheduleQueryDto {
  @IsString()
  @Matches(ISO_DATE)
  from!: string;

  @IsString()
  @Matches(ISO_DATE)
  to!: string;

  /** Optional: limit to one teacher.id (not users.id). */
  @IsOptional()
  @IsString()
  teacherId?: string;

  @IsOptional()
  @IsString()
  teacher_id?: string;
}
