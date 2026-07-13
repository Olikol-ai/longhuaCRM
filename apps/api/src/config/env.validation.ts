import { plainToInstance } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, validateSync } from 'class-validator';

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

  /** @deprecated Use MAIL_* variables */
  @IsString()
  @IsOptional()
  SMTP_FROM?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const parsed = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(parsed, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  if (parsed.NODE_ENV === 'production' && !parsed.JWT_SECRET) {
    throw new Error('JWT_SECRET must be set in production');
  }

  return parsed;
}
