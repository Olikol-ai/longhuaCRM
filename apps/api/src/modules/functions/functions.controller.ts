import {
  Body,
  Controller,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { normalizeRole } from '../../common/constants/roles';
import { OptionalJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { AlfaBankService } from '../alfabank/alfabank.service';
import { JobsService } from '../jobs/jobs.service';
import { TelegramService } from '../telegram/telegram.service';

/** Legacy RPC layer — prefer /jobs, /telegram/admin for admin operations. */
@Controller('functions')
export class FunctionsController {
  private readonly logger = new Logger(FunctionsController.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly alfaBankService: AlfaBankService,
    private readonly jobsService: JobsService,
    private readonly config: ConfigService,
  ) {}

  @Post(':name')
  @UseGuards(OptionalJwtAuthGuard)
  async invoke(
    @Param('name') name: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
    @CurrentUser() user: JwtPayload | null,
  ) {
    const adminFunctions = [
      'exportBackup',
      'checkBotInfo',
      'registerTelegramWebhook',
      'revokeAllAccess',
      'autoCompleteExpiredLessons',
      'fixWebhook',
      'clearTelegramUpdates',
      'sendTelegramMessage',
      'tgDebug',
    ];
    const studentFunctions = ['alfaBankInit', 'checkPaymentStatus'];

    const known = [...adminFunctions, ...studentFunctions].includes(name);

    if (!known) {
      throw new NotFoundException(`Unknown function: ${name}`);
    }

    if (adminFunctions.includes(name)) {
      if (!user || normalizeRole(user.role) !== 'admin') {
        throw new ForbiddenException('Forbidden: Admin access required');
      }
    } else if (studentFunctions.includes(name)) {
      if (!user) {
        throw new UnauthorizedException('Unauthorized');
      }
    }

    try {
      return await this.dispatch(name, body, req, user);
    } catch (error) {
      this.logger.error(`Function ${name} error: ${(error as Error).message}`);
      throw new InternalServerErrorException((error as Error).message);
    }
  }

  private async dispatch(
    name: string,
    body: Record<string, unknown>,
    req: Request,
    user: JwtPayload | null,
  ) {
    const origin = `${req.protocol}://${req.get('host')}`;
    const configuredWebhook = (this.config.get<string>('telegram.webhookUrl') ?? '').trim();
    const webhookUrl = configuredWebhook || `${origin}/api/telegram/webhook`;

    switch (name) {
      case 'sendTelegramMessage':
        return this.telegramService.sendMessage(String(body.chat_id), String(body.text));
      case 'alfaBankInit':
        return this.alfaBankService.init({
          type: String(body.type),
          itemId: String(body.itemId),
          studentId: String(body.studentId),
          returnUrl: body.returnUrl as string | undefined,
          origin,
          userId: user!.sub,
          userRole: user!.role,
        });
      case 'checkPaymentStatus':
        return this.alfaBankService.checkPaymentStatus(
          String(body.orderId),
          user!.sub,
          user!.role,
        );
      case 'exportBackup':
        return this.jobsService.exportBackup();
      case 'fixWebhook':
      case 'registerTelegramWebhook':
      case 'clearTelegramUpdates': {
        const secret = this.config.get<string>('telegram.webhookSecret') || undefined;
        return this.telegramService.registerWebhook(webhookUrl, secret);
      }
      case 'checkBotInfo':
        return this.telegramService.getBotInfo();
      case 'autoCompleteExpiredLessons':
        return this.jobsService.autoCompleteExpiredLessons();
      case 'revokeAllAccess':
        return this.jobsService.revokeAllAccess();
      case 'tgDebug':
        this.logger.debug(`tgDebug ${req.method} body keys=${Object.keys(body).join(',')}`);
        return { ok: true };
      default:
        throw new Error(`Unknown function: ${name}`);
    }
  }
}
