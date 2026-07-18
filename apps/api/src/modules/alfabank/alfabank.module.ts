import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { SettingsModule } from '../settings/settings.module';
import { TelegramModule } from '../telegram/telegram.module';
import { AuditModule } from '../audit/audit.module';
import { AlfaBankController } from './alfabank.controller';
import { AlfaBankService } from './alfabank.service';
import { PaymentsAlfaController } from './payments-alfa.controller';

@Module({
  imports: [PaymentsModule, SettingsModule, TelegramModule, AuditModule],
  controllers: [AlfaBankController, PaymentsAlfaController],
  providers: [AlfaBankService],
  exports: [AlfaBankService],
})
export class AlfaBankModule {}
