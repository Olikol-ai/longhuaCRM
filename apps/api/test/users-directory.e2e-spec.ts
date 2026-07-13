import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import {
  api,
  authHeader,
  createTestApp,
  ensureDatabaseReady,
  adminLogin,
} from './e2e-helpers';
import { UserEntity } from '../src/modules/users/entities/user.entity';

describe('Users directory (DATA-001)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    await ensureDatabaseReady();
    app = await createTestApp();
    const admin = await adminLogin(app);
    adminToken = admin.token;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('includes unlinked student profiles in GET /api/users/directory', async () => {
    const suffix = randomUUID().slice(0, 8);
    const studentName = `Directory Student ${suffix}`;

    const createRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: studentName, status: 'active' });

    expect(createRes.status).toBe(201);
    const studentId = createRes.body.id as string;

    const directoryRes = await api(app)
      .get('/api/users/directory')
      .set(authHeader(adminToken));

    expect(directoryRes.status).toBe(200);
    expect(Array.isArray(directoryRes.body)).toBe(true);

    const profileEntry = directoryRes.body.find(
      (row: { id: string; entry_type?: string }) =>
        row.id === studentId && row.entry_type === 'student_profile',
    );

    expect(profileEntry).toBeDefined();
    expect(profileEntry.has_account).toBe(false);
    expect(profileEntry.role).toBe('student');
    expect(profileEntry.full_name).toBe(studentName);
  });

  it('links student profile to existing user by email on create', async () => {
    const suffix = randomUUID().slice(0, 8);
    const email = `linked-student-${suffix}@example.com`;
    const userId = randomUUID();
    const now = new Date();

    const ds = app.get(DataSource);
    await ds.getRepository(UserEntity).save({
      id: userId,
      email,
      passwordHash: bcrypt.hashSync('TestPass123!', 10),
      role: 'student',
      status: 'active',
      emailVerified: true,
      verificationCode: null,
      verificationCodeExpiresAt: null,
      verificationCodeSentAt: null,
      verificationAttempts: 0,
      firstName: 'Link',
      lastName: 'Student',
      phone: '',
      telegramId: '',
      telegramUsername: '',
      telegramLinkToken: null,
      telegramLinkExpires: null,
      createdDate: now,
      updatedDate: now,
    });

    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `Linked ${suffix}`, email, status: 'active' });

    expect(studentRes.status).toBe(201);
    expect(studentRes.body.user_id ?? studentRes.body.userId).toBe(userId);
  });

  it('rejects directory access for non-admin users', async () => {
    const res = await api(app).get('/api/users/directory');
    expect(res.status).toBe(401);
  });
});
