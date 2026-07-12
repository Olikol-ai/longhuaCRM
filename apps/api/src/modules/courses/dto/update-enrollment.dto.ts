import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { EnrollmentStatus } from '../entities/enrollment.entity';

export class UpdateEnrollmentDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsUUID()
  courseTemplateId?: string;

  @IsOptional()
  @IsString()
  courseName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  completedLessons?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalLessons?: number;

  @IsOptional()
  @IsEnum(['active', 'completed', 'paused'])
  status?: EnrollmentStatus;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
