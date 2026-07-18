import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { BlueprintSectionRuleDto } from './create-blueprint.dto';

export class UpdateBlueprintDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ type: [BlueprintSectionRuleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlueprintSectionRuleDto)
  section_rules?: BlueprintSectionRuleDto[];
}
