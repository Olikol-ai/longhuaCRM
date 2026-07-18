import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ContentLifecycleStatus, QuestionType } from '../../enums';
import { PaginationQueryDto } from '../common/pagination-query.dto';

export class ListQuestionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  bank_id?: string;

  @ApiPropertyOptional({ enum: ContentLifecycleStatus })
  @IsOptional()
  @IsEnum(ContentLifecycleStatus)
  status?: ContentLifecycleStatus;

  @ApiPropertyOptional({ enum: QuestionType })
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  topic_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  difficulty_min?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(5)
  difficulty_max?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
