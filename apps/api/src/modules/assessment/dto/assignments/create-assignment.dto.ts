import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AssignmentTargetType } from '../../enums';

export class CreateAssignmentDto {
  @ApiProperty()
  @IsUUID()
  exam_id!: string;

  @ApiProperty({ enum: AssignmentTargetType })
  @IsEnum(AssignmentTargetType)
  target_type!: AssignmentTargetType;

  @ApiProperty()
  @IsUUID()
  target_id!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  valid_from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  valid_to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assessment_rule_override_id?: string;
}
