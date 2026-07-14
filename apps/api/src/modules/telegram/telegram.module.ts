import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { LessonConfirmationsModule } from '../lesson-confirmations/lesson-confirmations.module';
import { SettingsModule } from '../settings/settings.module';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { UserEntity } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { TelegramAdminController } from './telegram-admin.controller';
import { TelegramController } from './telegram.controller';
import { TelegramDiagnosticsService } from './telegram-diagnostics.service';
import { TelegramGatewayModule } from './telegram-gateway.module';
import { TelegramLinkController } from './telegram-link.controller';
import { TelegramLinkService } from './telegram-link.service';
import { TelegramMenuService } from './telegram-menu.service';
import { TelegramPollingService } from './telegram.polling.service';
import { TelegramService } from './telegram.service';
import { TelegramStartupLogger } from './telegram-startup.logger';
import { TelegramUpdateHandler } from './telegram-update.handler';
import { TelegramWebhookLifecycleService } from './telegram-webhook.lifecycle';

@Module({
  imports: [
    SettingsModule,
    TelegramGatewayModule,
    LessonConfirmationsModule,
    UsersModule,
    AuditModule,
    forwardRef(() => AuthModule),
    TypeOrmModule.forFeature([
      StudentEntity,
      TeacherEntity,
      LessonEntity,
      UserEntity,
    ]),
  ],
  controllers: [
    TelegramAdminController,
    TelegramController,
    TelegramLinkController,
  ],
  providers: [
    TelegramDiagnosticsService,
    TelegramLinkService,
    TelegramMenuService,
    TelegramUpdateHandler,
    TelegramService,
    TelegramStartupLogger,
    TelegramWebhookLifecycleService,
    TelegramPollingService,
  ],
  exports: [
    TelegramService,
    TelegramLinkService,
    TelegramGatewayModule,
    LessonConfirmationsModule,
    TelegramDiagnosticsService,
  ],
})
export class TelegramModule {}
