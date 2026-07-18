import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class BlueprintSectionRuleDto {
  @ApiProperty()
  @IsString()
  section_key!: string;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  question_count!: number;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  question_types!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  difficulty_min?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Max(5)
  difficulty_max?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  topic_ids?: string[];

  @ApiProperty()
  @IsNumber()
  @Min(0)
  weight!: number;
}

export class CreateBlueprintDto {
  @ApiProperty()
  @IsUUID()
  exam_template_id!: string;

  @ApiProperty()
  @IsUUID()
  bank_id!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ type: [BlueprintSectionRuleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlueprintSectionRuleDto)
  section_rules?: BlueprintSectionRuleDto[];
}
