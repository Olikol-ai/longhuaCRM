import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';
import { StudentStatus } from '../entities/student.entity';

/**
 * Empty strings from the FE are treated as “omit / clear” via ValidateIf,
 * so @IsEmail / @IsUUID do not reject "".
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

  @IsOptional()
  @IsInt()
  @Min(0)
  lessonBalance?: number;

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
  @IsEnum(['active', 'inactive', 'paused'])
  status?: StudentStatus;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== undefined && String(v).trim() !== '')
  @IsUUID()
  userId?: string | null;
}
