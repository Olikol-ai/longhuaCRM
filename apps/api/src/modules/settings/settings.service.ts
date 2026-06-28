import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityRepositoryService } from '../entities/entity-repository.service';

@Injectable()
export class SettingsService {
  constructor(
    private readonly entityRepository: EntityRepositoryService,
    private readonly config: ConfigService,
  ) {}

  async getTelegramBotToken(): Promise<string | null> {
    const fromEnv = this.config.get<string>('telegram.botToken');
    if (fromEnv) return fromEnv;

    const ctx = this.entityRepository.getSystemContext();
    const settings = await this.entityRepository.filter('AppSettings', { key: 'telegram_bot_token' }, ctx);
    return (settings[0]?.value as string) || null;
  }

  async getAlfaCredentials(): Promise<{ token?: string; merchantId?: string }> {
    const ctx = this.entityRepository.getSystemContext();
    const tokenSetting = await this.entityRepository.filter('AppSettings', { key: 'alfa_bank_token' }, ctx);
    const token = this.config.get<string>('alfaBank.token') || (tokenSetting[0]?.value as string);
    const merchantId = this.config.get<string>('alfaBank.merchantId');
    return { token, merchantId };
  }
}
