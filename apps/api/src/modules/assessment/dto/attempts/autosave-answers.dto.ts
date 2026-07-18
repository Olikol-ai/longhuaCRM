import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

/**
 * One answer row for Attempt autosave.
 * Accepts task field names and api-contract aliases.
 */
export class AutosaveAnswerItemDto {
  @ApiProperty()
  @IsUUID()
  question_snapshot_id!: string;

  /** Selected AnswerSnapshot ids (preferred task name). */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  selected_answer_ids?: string[];

  /** api-contract alias for selected_answer_ids. */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  selected_answer_snapshot_ids?: string[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  text_answer?: string | null;

  /** api-contract alias for text_answer. */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  text?: string | null;
}

export class AutosaveAnswersDto {
  @ApiProperty({ type: [AutosaveAnswerItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AutosaveAnswerItemDto)
  answers!: AutosaveAnswerItemDto[];
}
