import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { PendingRegistrationEntity } from '../src/modules/auth/entities/pending-registration.entity';
import { REGISTRATION_EMAIL_FAILED_MESSAGE } from '../src/modules/auth/pending-registration.service';
import { api, createTestApp, ensureDatabaseReady } from './e2e-helpers';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

describeE2E('Registration email failure (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await ensureDatabaseReady();
    app = await createTestApp({ mockMailSuccess: false });
  }, 180000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('returns 500 and does not keep pending user when email send fails', async () => {
    const email = `mail-fail-${randomUUID()}@test.local`;
    const password = 'SecurePass123!';

    const registerRes = await api(app)
      .post('/api/auth/register')
      .send({
        email,
        password,
        first_name: 'Mail',
        last_name: 'Fail',
      });

    expect(registerRes.status).toBe(500);
    expect(registerRes.body.message).toBe(REGISTRATION_EMAIL_FAILED_MESSAGE);

    const ds = app.get(DataSource);
    const pending = await ds.getRepository(PendingRegistrationEntity).findOne({
      where: { email },
    });
    expect(pending).toBeNull();
  });
});
