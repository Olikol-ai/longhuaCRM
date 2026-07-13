import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { TEST_EMAIL_DOMAIN } from '../src/common/security/email-validation';
import { api, createTestApp, ensureDatabaseReady } from './e2e-helpers';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

describeE2E('Registration email domain (e2e)', () => {
  let app: INestApplication;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    await ensureDatabaseReady();
    app = await createTestApp();
  }, 180000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    process.env.NODE_ENV = originalNodeEnv;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('accepts test.local registration in test environment', async () => {
    process.env.NODE_ENV = 'test';
    const email = `domain-ok-${randomUUID()}@${TEST_EMAIL_DOMAIN}`;

    const res = await api(app)
      .post('/api/auth/register')
      .send({
        email,
        password: 'SecurePass123!',
        first_name: 'Test',
        last_name: 'Local',
      });

    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
  });

  it('rejects test.local registration outside test environment', async () => {
    process.env.NODE_ENV = 'production';
    const email = `domain-block-${randomUUID()}@${TEST_EMAIL_DOMAIN}`;

    const res = await api(app)
      .post('/api/auth/register')
      .send({
        email,
        password: 'SecurePass123!',
        first_name: 'Test',
        last_name: 'Local',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/test\.local|not allowed/i);
  });
});
