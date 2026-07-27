import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { IsRequiredText } from '../../../common/validators/is-required-text.decorator';
import { TutorStatus } from '../entities/tutor.entity';

export class CreateTutorDto {
  @IsRequiredText()
  displayName!: string;

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

  /** Placeholder only — finance not active in Stage 1. */
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
