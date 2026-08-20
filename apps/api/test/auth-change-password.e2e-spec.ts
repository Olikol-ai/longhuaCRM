import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import {
  api,
  authHeader,
  createTestApp,
  ensureDatabaseReady,
  login,
} from './e2e-helpers';
import { UserEntity } from '../src/modules/users/entities/user.entity';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

describeE2E('Auth change-password (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await ensureDatabaseReady();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  async function createUser(password: string) {
    const ds = app.get(DataSource);
    const id = randomUUID();
    const email = `pwd-${randomUUID().slice(0, 8)}@test.local`;
    const now = new Date();
    await ds.getRepository(UserEntity).save({
      id,
      email,
      passwordHash: bcrypt.hashSync(password, 10),
      role: 'student',
      status: 'active',
      emailVerified: true,
      verificationCode: null,
      verificationCodeExpiresAt: null,
      verificationCodeSentAt: null,
      verificationAttempts: 0,
      firstName: 'Pwd',
      lastName: 'Change',
      phone: '',
      telegramId: '',
      telegramUsername: '',
      telegramConnectedAt: null,
      telegramLinkToken: null,
      telegramLinkExpires: null,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      telegramNotify24h: true,
      telegramNotify3h: true,
      createdDate: now,
      updatedDate: now,
    });
    return { id, email, password };
  }

  it('requires auth', async () => {
    await api(app)
      .post('/api/auth/change-password')
      .send({
        current_password: 'OldPass1',
        new_password: 'NewPass1',
        confirm_password: 'NewPass1',
      })
      .expect(401);
  });

  it('changes password only for the authenticated user', async () => {
    const user = await createUser('OldPass1');
    const session = await login(app, user.email, 'OldPass1');

    await api(app)
      .post('/api/auth/change-password')
      .set(authHeader(session.token))
      .send({
        current_password: 'wrong',
        new_password: 'NewPass1',
        confirm_password: 'NewPass1',
      })
      .expect(400);

    await api(app)
      .post('/api/auth/change-password')
      .set(authHeader(session.token))
      .send({
        current_password: 'OldPass1',
        new_password: 'NewPass1',
        confirm_password: 'Mismatch1',
      })
      .expect(400);

    await api(app)
      .post('/api/auth/change-password')
      .set(authHeader(session.token))
      .send({
        current_password: 'OldPass1',
        new_password: 'ab',
        confirm_password: 'ab',
      })
      .expect(400);

    const ok = await api(app)
      .post('/api/auth/change-password')
      .set(authHeader(session.token))
      .send({
        current_password: 'OldPass1',
        new_password: 'NewPass1',
        confirm_password: 'NewPass1',
      })
      .expect(201);

    expect(ok.body.ok).toBe(true);

    // Old password no longer works; new password does. Session token still accepted for /me.
    await login(app, user.email, 'OldPass1').catch(() => null);
    await api(app).post('/api/auth/login').send({ email: user.email, password: 'OldPass1' }).expect(401);
    await api(app).post('/api/auth/login').send({ email: user.email, password: 'NewPass1' }).expect(201);
    await api(app).get('/api/auth/me').set(authHeader(session.token)).expect(200);
  });
});
