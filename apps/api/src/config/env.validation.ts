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
