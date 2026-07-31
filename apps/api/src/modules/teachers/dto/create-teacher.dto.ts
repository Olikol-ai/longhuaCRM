import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ArrayUnique,
} from 'class-validator';
import { IsRequiredText } from '../../../common/validators/is-required-text.decorator';
import { TeacherStatus } from '../entities/teacher.entity';

export class CreateTeacherDto {
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
  @IsNumber()
  hourlyRate?: number;

  @IsOptional()
  @IsString()
  telegramId?: string;

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: TeacherStatus;

  @IsOptional()
  @IsString()
  specializations?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  subjectIds?: string[];
}
