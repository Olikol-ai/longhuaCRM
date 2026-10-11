import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { USER_STATUSES } from '../../auth/onboarding';

export class UpdateUserDto {
  @IsOptional()
  @IsEnum(['admin', 'teacher', 'tutor', 'student', 'tutor_student', 'pending', 'user', 'sales_manager'])
  role?: string;

  @IsOptional()
  @IsIn([...USER_STATUSES])
  status?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  telegramId?: string;
}
