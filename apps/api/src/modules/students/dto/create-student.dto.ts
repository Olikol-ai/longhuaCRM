import { Type } from 'class-transformer';
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
import { IsRequiredText } from '../../../common/validators/is-required-text.decorator';
import { StudentStatus } from '../entities/student.entity';

/**
 * lessonBalance may be negative (student debt). Never constrain with a non-negative minimum.
 */
export class CreateStudentDto {
  @IsRequiredText()
  name!: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  telegramId?: string;

  @IsOptional()
  @IsString()
  telegramUsername?: string;

  @IsOptional()
  @IsUUID()
  assignedTeacherId?: string;

  @IsOptional()
  @IsUUID()
  assignedTutorId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
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
  @IsEnum(['active', 'inactive', 'paused', 'pending_assignment'])
  status?: StudentStatus;

  @IsOptional()
  @IsUUID()
  userId?: string;
}
