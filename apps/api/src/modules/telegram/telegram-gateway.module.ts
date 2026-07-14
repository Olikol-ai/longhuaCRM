import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SettingsModule } from '../settings/settings.module';
import { HttpTelegramGateway } from './http-telegram.gateway';
import { MockTelegramGateway } from './mock-telegram.gateway';
import { TelegramGateway } from './telegram.gateway';

@Module({
  imports: [ConfigModule, SettingsModule],
  providers: [
    HttpTelegramGateway,
    MockTelegramGateway,
    {
      provide: TelegramGateway,
      inject: [ConfigService, HttpTelegramGateway, MockTelegramGateway],
      useFactory: (
        config: ConfigService,
        http: HttpTelegramGateway,
        mock: MockTelegramGateway,
      ) => {
        // Only explicit mock=true disables real Bot API calls.
        // Do not treat the string "false" as truthy.
        const useMock = config.get<boolean>('telegram.mock') === true;
        return useMock ? mock : http;
      },
    },
  ],
  exports: [TelegramGateway, HttpTelegramGateway, MockTelegramGateway],
})
export class TelegramGatewayModule {}
