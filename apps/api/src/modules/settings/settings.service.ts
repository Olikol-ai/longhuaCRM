import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsRepository } from './settings.repository';

const WELCOME_FIELDS = [
  'school_name',
  'title',
  'subtitle',
  'body_text',
  'info_text',
] as const;

@Injectable()
export class SettingsService {
  constructor(
    private readonly repository: SettingsRepository,
    private readonly config: ConfigService,
  ) {}

  async getTelegramBotToken(): Promise<string | null> {
    const fromEnv = this.config.get<string>('telegram.botToken');
    if (fromEnv) return fromEnv;

    const row = await this.repository.findByKey('telegram_bot_token');
    return row?.value || null;
  }

  async getAlfaCredentials(): Promise<{ token?: string; merchantId?: string }> {
    const tokenSetting = await this.repository.findByKey('alfa_bank_token');
    const token =
      this.config.get<string>('alfaBank.token') || tokenSetting?.value || undefined;
    const merchantId = this.config.get<string>('alfaBank.merchantId');
    return { token, merchantId };
  }

  findAll() {
    return this.repository.findAll();
  }

  getByKey(key: string) {
    return this.repository.findByKey(key);
  }

  upsert(key: string, value: string, description?: string) {
    return this.repository.upsert(key, value, description);
  }

  async getWelcomePage(): Promise<Record<string, string>> {
    const rows = await this.repository.findAll();
    const welcomeKeys = new Set(WELCOME_FIELDS.map((field) => `welcome_${field}`));
    const record: Record<string, string> = { id: 'welcome-page' };

    for (const row of rows) {
      if (!welcomeKeys.has(row.key)) continue;
      const field = row.key.replace(/^welcome_/, '');
      record[field] = row.value;
    }

    return record;
  }

  async saveWelcomePage(input: Record<string, unknown>): Promise<Record<string, string>> {
    for (const field of WELCOME_FIELDS) {
      if (input[field] === undefined) continue;
      await this.repository.upsert(`welcome_${field}`, String(input[field] ?? ''), 'Welcome page content');
    }
    return this.getWelcomePage();
  }
}
