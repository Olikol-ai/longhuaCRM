import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class SubmitAnswerDto {
  @ApiProperty()
  @IsUUID()
  question_snapshot_id!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  selected_answer_snapshot_ids?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  text?: string;
}

export class SubmitAttemptDto {
  @ApiPropertyOptional({ type: [SubmitAnswerDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerDto)
  answers?: SubmitAnswerDto[];
}
