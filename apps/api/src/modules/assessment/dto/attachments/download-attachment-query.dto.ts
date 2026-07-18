import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class DownloadAttachmentQueryDto {
  @ApiPropertyOptional({ enum: ['inline', 'attachment'], default: 'inline' })
  @IsOptional()
  @IsIn(['inline', 'attachment'])
  disposition?: 'inline' | 'attachment';
}
