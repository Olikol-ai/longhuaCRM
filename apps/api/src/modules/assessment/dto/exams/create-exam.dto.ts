import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { PassingMode, RetakePolicy, ShowCorrectAnswers } from '../../enums';

export class ExamRuleDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  duration_minutes!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  max_attempts?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allow_retake?: boolean;

  @ApiPropertyOptional({ enum: RetakePolicy })
  @IsOptional()
  @IsEnum(RetakePolicy)
  retake_policy?: RetakePolicy;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allow_review?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  show_result_after_submit?: boolean;

  @ApiPropertyOptional({ enum: ShowCorrectAnswers })
  @IsOptional()
  @IsEnum(ShowCorrectAnswers)
  show_correct_answers?: ShowCorrectAnswers;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  auto_submit_on_timeout?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allow_pause?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  randomize_questions?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  randomize_answers?: boolean;

  @ApiPropertyOptional({ enum: PassingMode })
  @IsOptional()
  @IsEnum(PassingMode)
  passing_mode?: PassingMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  pass_score_percent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allow_navigation?: boolean;
}

export class CreateExamDto {
  @ApiProperty()
  @IsUUID()
  blueprint_id!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  available_from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  available_to?: string;

  @ApiProperty({ type: ExamRuleDto })
  @ValidateNested()
  @Type(() => ExamRuleDto)
  rule!: ExamRuleDto;
}
