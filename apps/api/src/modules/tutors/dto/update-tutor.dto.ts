import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { TutorStatus } from '../entities/tutor.entity';

export class UpdateTutorDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  specializations?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(['active', 'inactive', 'pending'])
  status?: TutorStatus;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsNumber()
  defaultLessonPrice?: number;

  @IsOptional()
  @IsNumber()
  commissionPercent?: number;

  @IsOptional()
  @IsString()
  payoutAccountRef?: string;
}
