import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, Matches, Min } from 'class-validator';

export class MonthlySummaryQueryDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'month must be in yyyy-MM format',
  })
  month!: string;
}

export class MonthlySummaryDetailsQueryDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'month must be in yyyy-MM format',
  })
  month!: string;

  @IsUUID()
  teacherId!: string;
}

export class MarkMonthPaidDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'month must be in yyyy-MM format',
  })
  month!: string;

  @IsUUID()
  teacherId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;
}
