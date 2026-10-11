import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { StudentStatus } from '../entities/student.entity';

/**
 * Empty strings from the FE are treated as “omit / clear” via ValidateIf,
 * so @IsEmail / @IsUUID do not reject "".
 *
 * lessonBalance is intentionally absent: ordinary PATCH /students must never
 * overwrite students.lesson_balance (stale forms). Use admin balance adjust /
 * payments / lesson completion / merge instead.
 *
 * With ValidationPipe whitelist=true, a client-sent lessonBalance is stripped
 * before the service runs; StudentsService.update also deletes it defensively.
 */
export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== undefined && String(v).trim() !== '')
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  telegramId?: string;

  @IsOptional()
  @IsString()
  telegramUsername?: string;

  /** null / "" clears assigned teacher */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== undefined && String(v).trim() !== '')
  @IsUUID()
  assignedTeacherId?: string | null;

  /** null / "" clears assigned tutor */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== undefined && String(v).trim() !== '')
  @IsUUID()
  assignedTutorId?: string | null;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  birthday?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(['active', 'inactive', 'paused', 'pending_assignment'])
  status?: StudentStatus;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== undefined && String(v).trim() !== '')
  @IsUUID()
  userId?: string | null;
}
