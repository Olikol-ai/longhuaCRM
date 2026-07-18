import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AttemptStatus } from '../../enums';
import { PaginationQueryDto } from '../common/pagination-query.dto';

export class ListAttemptsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  exam_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  student_id?: string;

  @ApiPropertyOptional({ enum: AttemptStatus })
  @IsOptional()
  @IsEnum(AttemptStatus)
  status?: AttemptStatus;
}
