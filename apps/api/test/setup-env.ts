import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

const rootEnv = join(__dirname, '../../../.env');
if (existsSync(rootEnv)) {
  loadEnv({ path: rootEnv });
}

const defaultDatabaseUrl = process.env.DATABASE_URL ?? '';
if (!process.env.E2E_DATABASE_URL && defaultDatabaseUrl) {
  process.env.E2E_DATABASE_URL = defaultDatabaseUrl.replace(/\/([^/?]+)(\?.*)?$/, '/longhua_e2e$2');
}

if (process.env.E2E_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.E2E_DATABASE_URL;
}

// Force test mode so TypeORM dropSchema/synchronize run (do not keep NODE_ENV=development from .env).
process.env.NODE_ENV = 'test';
process.env.E2E_SYNC_SCHEMA = process.env.E2E_SYNC_SCHEMA ?? 'true';
process.env.E2E_DROP_SCHEMA = process.env.E2E_DROP_SCHEMA ?? 'true';
process.env.SERVE_FRONTEND = 'false';
process.env.ENABLE_CRON = 'false';
process.env.TELEGRAM_ENABLED = 'false';
process.env.TELEGRAM_MOCK = 'true';
process.env.TELEGRAM_MODE = 'polling';
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@test.local';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'TestAdmin123!';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret';
process.env.ALFA_BANK_TOKEN = 'e2e-test-alfa-token';
process.env.ALFA_BANK_MERCHANT_ID = 'e2e-merchant';
// Prevent MailService from blocking app bootstrap on real SMTP verify during E2E.
process.env.MAIL_PASS = '';
process.env.SMTP_PASSWORD = '';
process.env.MAIL_USER = '';
