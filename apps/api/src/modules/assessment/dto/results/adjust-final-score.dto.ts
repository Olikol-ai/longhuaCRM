import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class AdjustFinalScoreDto {
  @ApiProperty({
    description:
      'New final score (0..max_score). Does not change per-question scores.',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  score!: number;

  @ApiProperty({
    description:
      'Expected current final score (optimistic concurrency / confirm dialog).',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  expected_score!: number;

  @ApiPropertyOptional({ description: 'Optional reason for the adjustment' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string | null;
}
