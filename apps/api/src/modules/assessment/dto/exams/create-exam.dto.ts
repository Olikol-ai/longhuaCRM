import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
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

export class ExamPartPoolItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  question_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  reading_task_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  listening_task_id?: string;

  /** @deprecated Prefer reading_task_id / listening_task_id */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  content_task_id?: string;
}

export class ExamPartDto {
  @ApiProperty({ enum: ['test', 'listening', 'reading'] })
  @IsEnum(['test', 'listening', 'reading'])
  part_kind!: 'test' | 'listening' | 'reading';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  select_count!: number;

  @ApiProperty({ type: [ExamPartPoolItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExamPartPoolItemDto)
  pool!: ExamPartPoolItemDto[];
}

export class CreateExamDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Legacy: ordered published ExamBlock IDs',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  block_ids?: string[];

  @ApiPropertyOptional({
    type: [ExamPartDto],
    description: 'Preferred: generation parts with pools',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExamPartDto)
  parts?: ExamPartDto[];

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
