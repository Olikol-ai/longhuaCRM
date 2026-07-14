import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { LessonConfirmationService } from '../lesson-confirmations/lesson-confirmation.service';
import { TelegramDiagnosticsService } from './telegram-diagnostics.service';
import { TelegramLinkService } from './telegram-link.service';
import { TelegramService } from './telegram.service';

class SendTestTelegramDto {
  @IsIn(['student', 'teacher'])
  targetType!: 'student' | 'teacher';

  @IsUUID()
  targetId!: string;

  @IsOptional()
  @IsString()
  message?: string;
}

class SendTestLessonConfirmationDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsUUID()
  lessonId?: string;
}

@Controller('telegram/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class TelegramAdminController {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly config: ConfigService,
    private readonly diagnostics: TelegramDiagnosticsService,
    private readonly lessonConfirmations: LessonConfirmationService,
    private readonly linkService: TelegramLinkService,
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
  ) {}

  @Get('status')
  async status() {
    const enabled = this.config.get<boolean>('telegram.enabled') === true;
    const mode = this.config.get<string>('telegram.mode') ?? 'webhook';
    const mock = this.config.get<boolean>('telegram.mock') === true;
    const botToken = (this.config.get<string>('telegram.botToken') ?? '').trim();
    const debug = this.diagnostics.snapshot();

    let botConnected = false;
    let webhookInfo: unknown = null;
    try {
      if (botToken && !mock) {
        const info = await this.telegramService.getBotInfo();
        botConnected = Boolean((info.bot as { ok?: boolean })?.ok ?? info.bot);
        webhookInfo = info.webhook;
      } else if (mock) {
        botConnected = true;
        webhookInfo = { mock: true };
      }
    } catch {
      botConnected = false;
    }

    return {
      botConnected,
      enabled,
      mode,
      mock,
      botTokenConfigured: Boolean(botToken),
      webhook: webhookInfo,
      polling: {
        expected: mode === 'polling' && enabled && !mock,
        running: debug.pollingRunning,
      },
      debug,
    };
  }

  @Post('send-test')
  async sendTest(@Body() body: SendTestTelegramDto) {
    const message =
      (body.message ?? '').trim() ||
      '✅ Тестовое уведомление Longhua CRM успешно отправлено.';

    const target =
      body.targetType === 'student'
        ? await this.studentRepo.findOne({ where: { id: body.targetId } })
        : await this.teacherRepo.findOne({ where: { id: body.targetId } });

    if (!target) {
      throw new BadRequestException('Пользователь не найден');
    }

    const contact = await this.linkService.resolveTelegramForProfile(
      body.targetType,
      body.targetId,
    );

    if (!contact.linked || !contact.telegramId) {
      return {
        ok: false,
        linked: false,
        telegram_id: null,
        telegram_username: contact.username,
        error: 'У пользователя не подключен Telegram',
      };
    }

    const result = await this.telegramService.sendMessage(
      contact.telegramId,
      message,
    );
    return {
      ok: Boolean(result.ok),
      linked: true,
      telegram_id: contact.telegramId,
      telegram_username: contact.username,
      result,
      error: result.ok ? null : (result.error ?? result.description ?? 'send failed'),
    };
  }

  @Post('send-test-confirmation')
  async sendTestConfirmation(@Body() body: SendTestLessonConfirmationDto) {
    const confirmation = await this.lessonConfirmations.sendTestConfirmation(
      body.studentId,
      body.lessonId,
    );
    return {
      ok: true,
      confirmation: {
        id: confirmation.id,
        lessonId: confirmation.lessonId,
        studentId: confirmation.studentId,
        telegramChatId: confirmation.telegramChatId,
        status: confirmation.status,
        requestedAt: confirmation.requestedAt,
      },
    };
  }

  @Post('register-webhook')
  registerWebhook(@Req() req: Request) {
    return this.registerWithSecret(req);
  }

  @Post('fix-webhook')
  fixWebhook(@Req() req: Request) {
    return this.registerWithSecret(req);
  }

  @Post('clear-updates')
  clearTelegramUpdates(@Req() req: Request) {
    return this.registerWithSecret(req);
  }

  @Post('check-bot-info')
  checkBotInfo() {
    return this.telegramService.getBotInfo();
  }

  private registerWithSecret(req: Request) {
    const configured = this.config.get<string>('telegram.webhookUrl');
    const origin = `${req.protocol}://${req.get('host')}`;
    const webhookUrl =
      configured || `${origin}/api/telegram/webhook`;
    const secret = this.config.get<string>('telegram.webhookSecret') || undefined;
    return this.telegramService.registerWebhook(webhookUrl, secret);
  }
}
