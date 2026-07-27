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
import { TutorEntity } from '../src/modules/tutors/entities/tutor.entity';
import { UserEntity } from '../src/modules/users/entities/user.entity';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

const PASSWORD = 'TestPass123!';

async function createActiveTutor(
  app: INestApplication,
  params: { email: string; firstName: string; lastName: string },
): Promise<{ userId: string; tutorId: string; token: string }> {
  const userId = randomUUID();
  const tutorId = randomUUID();
  const now = new Date();
  const ds = app.get(DataSource);
  const displayName = `${params.lastName} ${params.firstName}`.trim();

  await ds.getRepository(UserEntity).save({
    id: userId,
    email: params.email,
    passwordHash: bcrypt.hashSync(PASSWORD, 10),
    role: 'tutor',
    status: 'active',
    emailVerified: true,
    verificationCode: null,
    verificationCodeExpiresAt: null,
    verificationCodeSentAt: null,
    verificationAttempts: 0,
    firstName: params.firstName,
    lastName: params.lastName,
    phone: '',
    telegramId: '',
    telegramUsername: '',
    telegramConnectedAt: null,
    telegramLinkToken: null,
    telegramLinkExpires: null,
    createdDate: now,
    updatedDate: now,
  });

  await ds.getRepository(TutorEntity).save({
    id: tutorId,
    userId,
    status: 'active',
    displayName,
    bio: null,
    specializations: null,
    email: params.email,
    phone: null,
    defaultLessonPrice: null,
    commissionPercent: null,
    payoutAccountRef: null,
  });

  const session = await login(app, params.email, PASSWORD);
  return { userId, tutorId, token: session.token };
}

describeE2E('Tutor self-service profile update (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await ensureDatabaseReady();
    app = await createTestApp();
  }, 180000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('tutor can change own full name; role stays tutor; tutor.displayName syncs', async () => {
    const suffix = randomUUID().slice(0, 8);
    const email = `tutor-profile-${suffix}@test.local`;
    const { userId, tutorId, token } = await createActiveTutor(app, {
      email,
      firstName: 'Старое',
      lastName: 'Имя',
    });

    const patchRes = await api(app)
      .patch('/api/auth/me')
      .set(authHeader(token))
      .send({ full_name: 'Петров Пётр Петрович' })
      .expect(200);

    const patched = patchRes.body.user ?? patchRes.body;
    expect(patched.role).toBe('tutor');
    expect(patched.full_name).toBe('Петров Пётр Петрович');
    expect(patched.last_name).toBe('Петров');
    expect(patched.first_name).toBe('Пётр Петрович');
    expect(patched.id).toBe(userId);

    const meRes = await api(app)
      .get('/api/auth/me')
      .set(authHeader(token))
      .expect(200);
    const me = meRes.body.user ?? meRes.body;
    expect(me.full_name).toBe('Петров Пётр Петрович');
    expect(me.role).toBe('tutor');

    const ds = app.get(DataSource);
    const tutor = await ds.getRepository(TutorEntity).findOne({ where: { id: tutorId } });
    expect(tutor?.displayName).toBe('Петров Пётр Петрович');

    const user = await ds.getRepository(UserEntity).findOne({ where: { id: userId } });
    expect(user?.role).toBe('tutor');
    expect(user?.lastName).toBe('Петров');
    expect(user?.firstName).toBe('Пётр Петрович');
  });

  it('tutor cannot change another user via PATCH /users/:id', async () => {
    const suffix = randomUUID().slice(0, 8);
    const a = await createActiveTutor(app, {
      email: `tutor-a-${suffix}@test.local`,
      firstName: 'Альфа',
      lastName: 'Репетитор',
    });
    const b = await createActiveTutor(app, {
      email: `tutor-b-${suffix}@test.local`,
      firstName: 'Бета',
      lastName: 'Репетитор',
    });

    await api(app)
      .patch(`/api/users/${b.userId}`)
      .set(authHeader(a.token))
      .send({ firstName: 'Хакер', lastName: 'Чужой' })
      .expect(403);

    const ds = app.get(DataSource);
    const victim = await ds.getRepository(UserEntity).findOne({ where: { id: b.userId } });
    expect(victim?.firstName).toBe('Бета');
    expect(victim?.lastName).toBe('Репетитор');
    expect(victim?.role).toBe('tutor');
  });

  it('PATCH /auth/me rejects role change and single-word full name', async () => {
    const suffix = randomUUID().slice(0, 8);
    const { token } = await createActiveTutor(app, {
      email: `tutor-val-${suffix}@test.local`,
      firstName: 'Валид',
      lastName: 'Имя',
    });

    await api(app)
      .patch('/api/auth/me')
      .set(authHeader(token))
      .send({ role: 'admin' })
      .expect(403);

    await api(app)
      .patch('/api/auth/me')
      .set(authHeader(token))
      .send({ full_name: 'Однослово' })
      .expect(400);

    const meRes = await api(app)
      .get('/api/auth/me')
      .set(authHeader(token))
      .expect(200);
    const me = meRes.body.user ?? meRes.body;
    expect(me.role).toBe('tutor');
    expect(me.full_name).toBe('Имя Валид');
  });
});
