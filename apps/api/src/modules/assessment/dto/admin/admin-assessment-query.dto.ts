import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const ATTEMPT_STATUSES = ['created', 'started', 'submitted'] as const;
const RESULT_STATUSES = [
  'processing',
  'pending_review',
  'passed',
  'failed',
  'invalidated',
] as const;

export class AdminExamRegistryQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({ description: 'Exam name search' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ description: 'Exam creator user id' })
  @IsOptional()
  @IsUUID()
  created_by_user_id?: string;

  @ApiPropertyOptional({ description: 'Assignment assigner user id' })
  @IsOptional()
  @IsUUID()
  assigned_by_user_id?: string;
}

export class AdminAttemptRegistryQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  exam_search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  exam_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  student_id?: string;

  @ApiPropertyOptional({ description: 'Student name search' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  student_search?: string;

  @ApiPropertyOptional({ description: 'Assignment assigner user id' })
  @IsOptional()
  @IsUUID()
  assigned_by_user_id?: string;

  @ApiPropertyOptional({ enum: ATTEMPT_STATUSES })
  @IsOptional()
  @IsIn(ATTEMPT_STATUSES)
  attempt_status?: (typeof ATTEMPT_STATUSES)[number];

  @ApiPropertyOptional({ enum: RESULT_STATUSES })
  @IsOptional()
  @IsIn(RESULT_STATUSES)
  result_status?: (typeof RESULT_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'Only results with score_source=manual' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  manual_only?: boolean;
}
