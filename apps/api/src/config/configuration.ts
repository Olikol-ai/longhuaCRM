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
    enabled: process.env.TELEGRAM_ENABLED !== 'false',
  },
  alfaBank: {
    token: process.env.ALFA_BANK_TOKEN,
    merchantId: process.env.ALFA_BANK_MERCHANT_ID,
    apiUrl: process.env.ALFA_BANK_API_URL ?? 'https://pay.alfabank.by/api',
  },
  jobs: {
    enabled: process.env.ENABLE_CRON !== 'false',
    reminderTimezone: process.env.REMINDER_TIMEZONE ?? 'Europe/Minsk',
  },
  serveFrontend: process.env.SERVE_FRONTEND !== 'false',
  appPublicUrl: process.env.APP_PUBLIC_URL,
});
