import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReviewAnswerItemDto {
  @ApiProperty({ description: 'Question snapshot id' })
  @IsUUID()
  question_snapshot_id!: string;

  @ApiProperty({ description: 'Awarded points for this answer' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  score!: number;

  @ApiPropertyOptional({ description: 'Teacher comment' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comment?: string | null;
}

export class SaveReviewDto {
  @ApiProperty({ type: [ReviewAnswerItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReviewAnswerItemDto)
  answers!: ReviewAnswerItemDto[];
}
