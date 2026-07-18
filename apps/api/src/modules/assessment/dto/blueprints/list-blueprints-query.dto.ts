import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ContentLifecycleStatus } from '../../enums';
import { PaginationQueryDto } from '../common/pagination-query.dto';

export class ListBlueprintsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  exam_template_id?: string;

  @ApiPropertyOptional({ enum: ContentLifecycleStatus })
  @IsOptional()
  @IsEnum(ContentLifecycleStatus)
  status?: ContentLifecycleStatus;
}
