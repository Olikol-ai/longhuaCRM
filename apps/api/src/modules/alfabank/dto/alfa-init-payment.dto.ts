import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class AlfaInitPaymentDto {
  @IsString()
  @IsIn(['package', 'course'])
  type!: 'package' | 'course';

  @IsUUID()
  item_id!: string;

  @IsUUID()
  student_id!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  return_url?: string;
}
