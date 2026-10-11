import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/auth.service';
import { AlfaBankService } from './alfabank.service';

class OfflinePaymentRequestDto {
  @IsString()
  @MinLength(1)
  student_id: string;

  @IsString()
  @MinLength(1)
  item_label: string;

  @IsNumber()
  amount: number;

  @IsString()
  @MinLength(1)
  method: string;

  @IsOptional()
  @IsString()
  item_id?: string;
}

@Controller('alfabank')
export class AlfaBankController {
  constructor(private readonly alfaBankService: AlfaBankService) {}

  @Post('offline-payment-request')
  @UseGuards(JwtAuthGuard, RolesGuard)
  /** Admin-only: student self-service top-up UI was removed. */
  @Roles('admin')
  async offlinePaymentRequest(
    @CurrentUser() user: JwtPayload,
    @Body() dto: OfflinePaymentRequestDto,
  ) {
    return this.alfaBankService.requestOfflinePayment({
      userId: user.sub,
      userRole: user.role,
      studentId: dto.student_id,
      itemLabel: dto.item_label,
      amount: dto.amount,
      method: dto.method,
      itemId: dto.item_id,
    });
  }
}
