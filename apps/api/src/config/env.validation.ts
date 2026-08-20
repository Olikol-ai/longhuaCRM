import { plainToInstance } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, validateSync } from 'class-validator';
import { getEmailDomain, TEST_EMAIL_DOMAIN } from '../common/security/email-validation';
import { resolveTelegramMode } from '../modules/telegram/telegram-mode.util';
import { parseEnvBoolean } from './env-boolean';

function assertProductionEmail(value: string | undefined, field: string): void {
  if (!value?.trim()) {
    return;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized.includes('localhost')) {
    throw new Error(`${field} must not use localhost in production`);
  }
  const domain = getEmailDomain(normalized);
  if (!domain) {
    return;
  }
  if (domain === TEST_EMAIL_DOMAIN || domain.endsWith('.local')) {
    throw new Error(`${field} must use a production email domain`);
  }
}

class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  @IsOptional()
  NODE_ENV?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  PORT?: number;

  @IsString()
  @IsOptional()
  LOG_LEVEL?: string;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  @IsOptional()
  JWT_SECRET?: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN?: string;

  @IsString()
  @IsOptional()
  ADMIN_EMAIL?: string;

  @IsString()
  @IsOptional()
  ADMIN_PASSWORD?: string;

  @IsString()
  @IsOptional()
  TELEGRAM_BOT_TOKEN?: string;

  @IsString()
  @IsOptional()
  TELEGRAM_WEBHOOK_URL?: string;

  @IsString()
  @IsOptional()
  TELEGRAM_WEBHOOK_SECRET?: string;

  @IsBoolean()
  @IsOptional()
  TELEGRAM_ENABLED?: boolean;

  @IsIn(['polling', 'webhook'])
  @IsOptional()
  TELEGRAM_MODE?: string;

  @IsBoolean()
  @IsOptional()
  TELEGRAM_MOCK?: boolean;

  /** Public bot username for deep-links (t.me/username), without @. */
  @IsString()
  @IsOptional()
  TELEGRAM_BOT_USERNAME?: string;

  @IsString()
  @IsOptional()
  ALFA_BANK_TOKEN?: string;

  @IsString()
  @IsOptional()
  ALFA_BANK_MERCHANT_ID?: string;

  @IsString()
  @IsOptional()
  ALFA_BANK_API_URL?: string;

  @IsBoolean()
  @IsOptional()
  ENABLE_CRON?: boolean;

  @IsString()
  @IsOptional()
  REMINDER_TIMEZONE?: string;

  @IsBoolean()
  @IsOptional()
  SERVE_FRONTEND?: boolean;

  @IsString()
  @IsOptional()
  APP_PUBLIC_URL?: string;

  @IsString()
  @IsOptional()
  MAIL_HOST?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  MAIL_PORT?: number;

  @IsBoolean()
  @IsOptional()
  MAIL_SECURE?: boolean;

  @IsString()
  @IsOptional()
  MAIL_USER?: string;

  @IsString()
  @IsOptional()
  MAIL_PASS?: string;

  @IsString()
  @IsOptional()
  MAIL_FROM?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  PENDING_REGISTRATION_TTL_HOURS?: number;

  @IsBoolean()
  @IsOptional()
  TRUST_PROXY?: boolean;

  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  RATE_LIMIT_TTL?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  RATE_LIMIT_MAX?: number;

  /** @deprecated Use MAIL_* variables */
  @IsString()
  @IsOptional()
  SMTP_HOST?: string;

  /** @deprecated Use MAIL_* variables */
  @IsInt()
  @Min(1)
  @IsOptional()
  SMTP_PORT?: number;

  /** @deprecated Use MAIL_* variables */
  @IsBoolean()
  @IsOptional()
  SMTP_SECURE?: boolean;

  /** @deprecated Use MAIL_* variables */
  @IsString()
  @IsOptional()
  SMTP_USER?: string;

  /** @deprecated Use MAIL_* variables */
  @IsString()
  @IsOptional()
  SMTP_PASS?: string;

  /** Alias for SMTP_PASS / MAIL_PASS */
  @IsString()
  @IsOptional()
  SMTP_PASSWORD?: string;

  /** @deprecated Use MAIL_* variables */
  @IsString()
  @IsOptional()
  SMTP_FROM?: string;
}

/**
 * Re-apply boolean env values from the raw config so enableImplicitConversion
 * cannot turn the string "false" into true (Boolean("false") === true).
 */
function normalizeEnvBooleans(
  parsed: EnvironmentVariables,
  raw: Record<string, unknown>,
): void {
  if ('TELEGRAM_ENABLED' in raw) {
    parsed.TELEGRAM_ENABLED = parseEnvBoolean(raw.TELEGRAM_ENABLED, true);
  }
  if ('TELEGRAM_MOCK' in raw) {
    parsed.TELEGRAM_MOCK = parseEnvBoolean(raw.TELEGRAM_MOCK, false);
  }
  if ('ENABLE_CRON' in raw) {
    parsed.ENABLE_CRON = parseEnvBoolean(raw.ENABLE_CRON, true);
  }
  if ('SERVE_FRONTEND' in raw) {
    parsed.SERVE_FRONTEND = parseEnvBoolean(raw.SERVE_FRONTEND, true);
  }
  if ('MAIL_SECURE' in raw) {
    parsed.MAIL_SECURE = parseEnvBoolean(raw.MAIL_SECURE, false);
  }
  if ('TRUST_PROXY' in raw) {
    parsed.TRUST_PROXY = parseEnvBoolean(raw.TRUST_PROXY, false);
  }
  if ('SMTP_SECURE' in raw) {
    parsed.SMTP_SECURE = parseEnvBoolean(raw.SMTP_SECURE, false);
  }
}

export function validateEnv(config: Record<string, unknown>) {
  const parsed = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  normalizeEnvBooleans(parsed, config);

  const errors = validateSync(parsed, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  if (parsed.NODE_ENV === 'production' && !parsed.JWT_SECRET) {
    throw new Error('JWT_SECRET must be set in production');
  }

  if (parsed.NODE_ENV === 'production' && parsed.JWT_SECRET) {
    const secret = parsed.JWT_SECRET.trim();
    if (secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters in production');
    }
    const lowered = secret.toLowerCase();
    const weakMarkers = [
      'change-me',
      'changeme',
      'longhua-dev-secret',
      'dev-secret',
      'test-secret',
      'your-secret',
    ];
    if (weakMarkers.some((marker) => lowered.includes(marker))) {
      throw new Error('JWT_SECRET is too weak for production');
    }
  }

  if (parsed.NODE_ENV === 'production') {
    if (!parsed.APP_PUBLIC_URL?.trim()) {
      throw new Error('APP_PUBLIC_URL must be set in production');
    }
    if (parsed.APP_PUBLIC_URL.includes('localhost')) {
      throw new Error('APP_PUBLIC_URL must not use localhost in production');
    }
    assertProductionEmail(parsed.ADMIN_EMAIL, 'ADMIN_EMAIL');
    assertProductionEmail(parsed.MAIL_FROM, 'MAIL_FROM');
    if ((parsed.CORS_ORIGINS ?? '').includes('localhost')) {
      throw new Error('CORS_ORIGINS must not include localhost in production');
    }

    const telegramEnabled = parsed.TELEGRAM_ENABLED !== false;
    const telegramMode = resolveTelegramMode(parsed.TELEGRAM_MODE, parsed.NODE_ENV);
    if (telegramEnabled && telegramMode === 'webhook') {
      if (!parsed.TELEGRAM_WEBHOOK_URL?.trim()) {
        throw new Error(
          'TELEGRAM_WEBHOOK_URL must be set in production webhook mode '
          + '(example: https://lk.longhuachinese.online/api/telegram/webhook)',
        );
      }
      if (!/^https:\/\//i.test(parsed.TELEGRAM_WEBHOOK_URL.trim())) {
        throw new Error('TELEGRAM_WEBHOOK_URL must be HTTPS in production');
      }
      if (!parsed.TELEGRAM_WEBHOOK_SECRET?.trim()) {
        throw new Error('TELEGRAM_WEBHOOK_SECRET must be set in production webhook mode');
      }
    }
  }

  return parsed;
}
