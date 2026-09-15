import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import {
  adminLogin,
  api,
  authHeader,
  createTestApp,
  ensureDatabaseReady,
} from './e2e-helpers';
import { StudentEntity } from '../src/modules/students/entities/student.entity';
import { TeacherEntity } from '../src/modules/teachers/entities/teacher.entity';
import { UserEntity } from '../src/modules/users/entities/user.entity';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

describeE2E('User account role none vs pending (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    await ensureDatabaseReady();
    app = await createTestApp();
    const admin = await adminLogin(app);
    adminToken = admin.token;
  }, 180000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  async function seedUser(
    email: string,
    role: string,
    status = 'active',
  ): Promise<string> {
    const userId = randomUUID();
    const now = new Date();
    const ds = app.get(DataSource);
    await ds.getRepository(UserEntity).save({
      id: userId,
      email,
      passwordHash: bcrypt.hashSync('TestPass123!', 10),
      role,
      status,
      emailVerified: true,
      verificationCode: null,
      verificationCodeExpiresAt: null,
      verificationCodeSentAt: null,
      verificationAttempts: 0,
      firstName: 'Role',
      lastName: 'Test',
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
    return userId;
  }

  it('awaiting-role user has account_role pending', async () => {
    const suffix = randomUUID().slice(0, 8);
    const email = `awaiting-${suffix}@test.local`;
    const userId = await seedUser(email, '');

    const getRes = await api(app)
      .get('/api/users/directory')
      .set(authHeader(adminToken))
      .expect(200);

    const entry = getRes.body.find((row: { id: string }) => row.id === userId);
    expect(entry).toBeDefined();
    expect(entry.account_role).toBe('pending');
    expect(entry.onboarding_state).toBe('awaiting_role');
    expect(entry.role).toBeNull();
  });

  it('assign none → API returns account_role user and persists in DB', async () => {
    const suffix = randomUUID().slice(0, 8);
    const email = `none-role-${suffix}@test.local`;
    const userId = await seedUser(email, 'teacher');
    const ds = app.get(DataSource);

    await ds.getRepository(TeacherEntity).save({
      id: randomUUID(),
      name: 'Role Test',
      email,
      firstName: 'Role',
      lastName: 'Test',
      userId,
      status: 'active',
    });

    const patchRes = await api(app)
      .patch(`/api/users/${userId}`)
      .set(authHeader(adminToken))
      .send({ role: 'user', status: 'active' })
      .expect(200);

    expect(patchRes.body.account_role).toBe('user');
    expect(patchRes.body.onboarding_state).toBe('active');
    expect(patchRes.body.role).toBeNull();

    const row = await ds.getRepository(UserEntity).findOne({ where: { id: userId } });
    expect(row?.role).toBe('user');

    const reload = await api(app)
      .get('/api/users/directory')
      .set(authHeader(adminToken))
      .expect(200);
    const entry = reload.body.find((r: { id: string }) => r.id === userId);
    expect(entry?.account_role).toBe('user');
    expect(entry?.onboarding_state).toBe('active');
  });

  it('none → teacher and teacher → none transitions', async () => {
    const suffix = randomUUID().slice(0, 8);
    const email = `transition-${suffix}@test.local`;
    const userId = await seedUser(email, '');

    await api(app)
      .patch(`/api/users/${userId}`)
      .set(authHeader(adminToken))
      .send({ role: 'teacher', status: 'active' })
      .expect(200);

    let directory = await api(app)
      .get('/api/users/directory')
      .set(authHeader(adminToken))
      .expect(200);
    expect(directory.body.find((r: { id: string }) => r.id === userId)?.account_role).toBe(
      'teacher',
    );

    await api(app)
      .patch(`/api/users/${userId}`)
      .set(authHeader(adminToken))
      .send({ role: 'user', status: 'active' })
      .expect(200);

    directory = await api(app)
      .get('/api/users/directory')
      .set(authHeader(adminToken))
      .expect(200);
    expect(directory.body.find((r: { id: string }) => r.id === userId)?.account_role).toBe(
      'user',
    );
  });

  it('student → none stores user in DB', async () => {
    const suffix = randomUUID().slice(0, 8);
    const email = `student-none-${suffix}@test.local`;
    const userId = await seedUser(email, 'student');
    const ds = app.get(DataSource);

    await ds.getRepository(StudentEntity).save({
      id: randomUUID(),
      name: 'Student None',
      email,
      userId,
      status: 'active',
      lessonBalance: 0,
    });

    await api(app)
      .patch(`/api/users/${userId}`)
      .set(authHeader(adminToken))
      .send({ role: 'user', status: 'active' })
      .expect(200);

    const row = await ds.getRepository(UserEntity).findOne({ where: { id: userId } });
    expect(row?.role).toBe('user');
  });
});
