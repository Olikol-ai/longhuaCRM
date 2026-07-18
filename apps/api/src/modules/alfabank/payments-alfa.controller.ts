import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/auth.service';
import { AlfaBankService } from './alfabank.service';
import { AlfaInitPaymentDto } from './dto/alfa-init-payment.dto';

/**
 * Canonical student card-payment API over existing payments + AlfaBankService.
 * Legacy routes remain: POST /functions/alfaBankInit, POST /webhooks/alfabank.
 */
@Controller('payments/alfa')
export class PaymentsAlfaController {
  private readonly logger = new Logger(PaymentsAlfaController.name);

  constructor(private readonly alfaBank: AlfaBankService) {}

  @Post('init')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('student', 'admin')
  @HttpCode(HttpStatus.OK)
  async init(@CurrentUser() user: JwtPayload, @Body() dto: AlfaInitPaymentDto, @Req() req: Request) {
    const origin = `${req.protocol}://${req.get('host')}`;
    try {
      const result = await this.alfaBank.init({
        type: dto.type,
        itemId: dto.item_id,
        studentId: dto.student_id,
        returnUrl: dto.return_url,
        origin,
        userId: user.sub,
        userRole: user.role,
      });
      return {
        ok: true,
        payment_id: result.paymentId,
        order_id: result.orderId,
        redirect_url: result.redirectUrl,
        amount: result.amount,
        currency: 'BYN',
        reused: Boolean(result.reused),
      };
    } catch (error) {
      const message = (error as Error)?.message || '';
      if (/credentials not configured/i.test(message)) {
        throw new BadRequestException(
          'Онлайн-оплата временно недоступна. Выберите ЕРИП или наличные, либо свяжитесь со школой.',
        );
      }
      if (/gateway|Payment gateway/i.test(message)) {
        throw new BadRequestException(
          'Не удалось создать платёж в банке. Попробуйте ещё раз или выберите другой способ оплаты.',
        );
      }
      throw error;
    }
  }

  @Get('status/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('student', 'admin')
  async status(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) paymentId: string,
  ) {
    return this.alfaBank.getPaymentStatusForActor(paymentId, user.sub, user.role);
  }

  /**
   * Alias of POST /webhooks/alfabank — same handler, same idempotent confirm.
   */
  @Post('webhook')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async webhook(@Req() req: Request) {
    try {
      const bodyText =
        typeof req.body === 'string'
          ? req.body
          : new URLSearchParams(req.body as Record<string, string>).toString();
      return await this.alfaBank.handleWebhook(bodyText);
    } catch (error) {
      this.logger.error(`AlfaBank webhook (/payments/alfa/webhook) error: ${(error as Error).message}`);
      return '0';
    }
  }
}
