import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateTeacherStudentContactBalanceDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  newBalance!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string | null;
}
