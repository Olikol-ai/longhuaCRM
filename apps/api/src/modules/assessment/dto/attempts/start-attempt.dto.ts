import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class StartAttemptDto {
  @ApiProperty()
  @IsUUID()
  exam_id!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignment_id?: string;
}
