import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AssignmentTargetType } from '../../enums';
import { PaginationQueryDto } from '../common/pagination-query.dto';

export class ListAssignmentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  exam_id?: string;

  @ApiPropertyOptional({ enum: AssignmentTargetType })
  @IsOptional()
  @IsEnum(AssignmentTargetType)
  target_type?: AssignmentTargetType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  target_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;
}
