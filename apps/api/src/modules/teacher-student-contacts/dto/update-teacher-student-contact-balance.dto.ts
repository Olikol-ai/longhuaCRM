import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTeacherStudentContactBalanceDto {
  @Type(() => Number)
  @IsInt()
  newBalance!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string | null;
}
