import { resolveTelegramMode } from '../modules/telegram/telegram-mode.util';
import { parseEnvBoolean } from './env-boolean';
import { readMailEnvFromProcess } from './mail-config';

export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  logLevel: process.env.LOG_LEVEL ?? 'log',
  databaseUrl: process.env.DATABASE_URL,
  jwt: {
    secret:
      process.env.JWT_SECRET ??
      (process.env.NODE_ENV === 'production'
        ? undefined
        : 'longhua-dev-secret-change-in-production'),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  admin: {
    email: process.env.ADMIN_EMAIL ?? 'admin@longhua.local',
    password: process.env.ADMIN_PASSWORD,
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
    // Default enabled when unset; only explicit false disables.
    enabled: parseEnvBoolean(process.env.TELEGRAM_ENABLED, true),
    // Unset TELEGRAM_MODE → polling outside production (local getUpdates without a public domain).
    mode: resolveTelegramMode(process.env.TELEGRAM_MODE, process.env.NODE_ENV),
    mock: parseEnvBoolean(process.env.TELEGRAM_MOCK, false),
    botUsername:
      (process.env.TELEGRAM_BOT_USERNAME ?? '').trim().replace(/^@+/, ''),
  },
  alfaBank: {
    token: process.env.ALFA_BANK_TOKEN,
    merchantId: process.env.ALFA_BANK_MERCHANT_ID,
    apiUrl: process.env.ALFA_BANK_API_URL ?? 'https://pay.alfabank.by/api',
  },
  jobs: {
    enabled: parseEnvBoolean(process.env.ENABLE_CRON, true),
    reminderTimezone: process.env.REMINDER_TIMEZONE ?? 'Europe/Minsk',
  },
  serveFrontend: parseEnvBoolean(process.env.SERVE_FRONTEND, true),
  appPublicUrl: process.env.APP_PUBLIC_URL,
  video: {
    /** Corporate self-hosted Jitsi base URL (NOT public meet.jit.si / 8x8.vc). */
    jitsiBaseUrl: process.env.JITSI_BASE_URL ?? '',
    /** Required HS256 app id/secret — Prosody AUTH_TYPE=jwt, no guests. */
    jitsiJwtAppId: process.env.JITSI_JWT_APP_ID ?? '',
    jitsiJwtAppSecret: process.env.JITSI_JWT_APP_SECRET ?? '',
    jitsiJwtTtlSeconds: parseInt(process.env.JITSI_JWT_TTL_SECONDS ?? '900', 10),
  },
  mail: readMailEnvFromProcess(),
  pendingRegistration: {
    ttlHours: parseInt(process.env.PENDING_REGISTRATION_TTL_HOURS ?? '24', 10),
  },
  trustProxy: parseEnvBoolean(process.env.TRUST_PROXY, false),
  cors: {
    origins: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  },
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL ?? '60', 10),
    limit: parseInt(process.env.RATE_LIMIT_MAX ?? '120', 10),
  },
});

