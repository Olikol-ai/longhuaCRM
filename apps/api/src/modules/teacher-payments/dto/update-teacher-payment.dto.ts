import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TeacherPaymentStatus } from '../entities/teacher-payment.entity';

export class UpdateTeacherPaymentDto {
  @IsOptional()
  @IsEnum(['pending', 'paid'])
  status?: TeacherPaymentStatus;

  @IsOptional()
  @IsString()
  paidAt?: string;
}
