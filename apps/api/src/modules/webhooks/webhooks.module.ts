import { Module } from '@nestjs/common';
import { AlfaBankModule } from '../alfabank/alfabank.module';
import { TelegramModule } from '../telegram/telegram.module';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [TelegramModule, AlfaBankModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
