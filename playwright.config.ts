import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const apiURL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001';
const apiPort = process.env.PLAYWRIGHT_API_PORT ?? (new URL(apiURL).port || '3001');
const clientPort = process.env.PLAYWRIGHT_CLIENT_PORT ?? (new URL(baseURL).port || '5173');

export default defineConfig({
  testDir: './e2e/browser',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'e2e/browser/report.json' }]],
  timeout: 120_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  globalSetup: './e2e/browser/global-setup.ts',
  globalTeardown: './e2e/browser/global-teardown.ts',
  webServer: [
    {
      command: 'npm run migration:run --prefix apps/api && npm run start:prod --prefix apps/api',
      url: `${apiURL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        ...process.env,
        PORT: apiPort,
        NODE_ENV: 'test',
        SERVE_FRONTEND: 'false',
        ENABLE_CRON: 'false',
        TELEGRAM_ENABLED: 'false',
        ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? 'admin@test.local',
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? 'TestAdmin123!',
      },
    },
    {
      command: `npm run dev:client -- --host 127.0.0.1 --port ${clientPort} --strictPort`,
      url: `${baseURL}/login`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        VITE_API_PROXY_TARGET: apiURL,
      },
    },
  ],
});
