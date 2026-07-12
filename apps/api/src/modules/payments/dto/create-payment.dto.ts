import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { PaymentProvider, PaymentStatus } from '../entities/payment.entity';

export class CreatePaymentDto {
  @IsUUID()
  studentId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsEnum(['pending', 'paid', 'failed', 'refunded'])
  status?: PaymentStatus;

  @IsOptional()
  @IsEnum(['alfa_bank', 'cash', 'manual'])
  provider?: PaymentProvider;

  @IsOptional()
  @IsUUID()
  shopItemId?: string;

  @IsOptional()
  @IsUUID()
  enrollmentId?: string;

  @IsOptional()
  @IsUUID()
  lessonId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  lessonsAdded?: number;

  @IsOptional()
  @IsString()
  orderNumber?: string;

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  @IsString()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
