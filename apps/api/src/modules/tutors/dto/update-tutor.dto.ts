import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';
import { TutorStatus } from '../entities/tutor.entity';

const TIME_HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpdateTutorDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  photoUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  bio?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  teachingExperience?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  specialization?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  specializations?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  phone?: string | null;

  @IsOptional()
  @IsEnum(['active', 'inactive', 'pending'])
  status?: TutorStatus;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsNumber()
  defaultLessonPrice?: number | null;

  @IsOptional()
  @IsNumber()
  commissionPercent?: number;

  @IsOptional()
  @IsString()
  payoutAccountRef?: string;

  @IsOptional()
  @Matches(TIME_HH_MM, { message: 'workTimeFrom must be HH:MM' })
  workTimeFrom?: string | null;

  @IsOptional()
  @Matches(TIME_HH_MM, { message: 'workTimeTo must be HH:MM' })
  workTimeTo?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  learningDirections?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  teachingLanguages?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  lessonDurations?: number[];

  /** 0 = Monday … 6 = Sunday */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  workDays?: number[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  subjectIds?: string[];
}
