import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ContentLifecycleStatus } from '../../enums';
import { PaginationQueryDto } from '../common/pagination-query.dto';

export class ListExamTemplatesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ContentLifecycleStatus })
  @IsOptional()
  @IsEnum(ContentLifecycleStatus)
  status?: ContentLifecycleStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
