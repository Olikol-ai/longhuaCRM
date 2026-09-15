import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class AdjustStudentLessonBalanceDto {
  @Type(() => Number)
  @IsInt()
  newBalance!: number;

  /** Optional; omitted or empty is allowed. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
