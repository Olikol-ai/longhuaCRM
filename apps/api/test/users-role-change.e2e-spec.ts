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
import { UserEntity } from '../src/modules/users/entities/user.entity';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

describeE2E('User role change to student (e2e)', () => {
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

  it('assigns student role to awaiting-role user and creates student profile', async () => {
    const suffix = randomUUID().slice(0, 8);
    const email = `awaiting-role-${suffix}@test.local`;
    const userId = randomUUID();
    const now = new Date();

    const ds = app.get(DataSource);
    await ds.getRepository(UserEntity).save({
      id: userId,
      email,
      passwordHash: bcrypt.hashSync('TestPass123!', 10),
      role: '',
      status: 'active',
      emailVerified: true,
      verificationCode: null,
      verificationCodeExpiresAt: null,
      verificationCodeSentAt: null,
      verificationAttempts: 0,
      firstName: 'Await',
      lastName: 'Role',
      phone: '',
      telegramId: '',
      telegramUsername: '',
      telegramLinkToken: null,
      telegramLinkExpires: null,
      createdDate: now,
      updatedDate: now,
    });

    const patchRes = await api(app)
      .patch(`/api/users/${userId}`)
      .set(authHeader(adminToken))
      .send({ role: 'student', status: 'active' })
      .expect(200);

    expect(patchRes.body.role).toBe('student');
    expect(patchRes.body.onboarding_state).toBe('active');

    const student = await ds.getRepository(StudentEntity).findOne({ where: { userId } });
    expect(student).toBeTruthy();
    expect(student?.status).toBe('active');
    expect(student?.email).toBe(email);

    const [directoryRes, studentsRes, teachersRes] = await Promise.all([
      api(app).get('/api/users/directory').set(authHeader(adminToken)).expect(200),
      api(app).get('/api/students').set(authHeader(adminToken)).expect(200),
      api(app).get('/api/teachers').set(authHeader(adminToken)).expect(200),
    ]);

    const directoryEntry = directoryRes.body.find(
      (row: { id: string }) => row.id === userId,
    );
    expect(directoryEntry).toBeDefined();
    expect(directoryEntry.role).toBe('student');
    expect(directoryEntry.student_profile_id).toBe(student?.id);

    expect(
      studentsRes.body.some((row: { id: string }) => row.id === student?.id),
    ).toBe(true);
    expect(Array.isArray(teachersRes.body)).toBe(true);
  });

  it('assigns student role when orphan student profile with same email exists', async () => {
    const suffix = randomUUID().slice(0, 8);
    const email = `orphan-link-${suffix}@test.local`;
    const userId = randomUUID();
    const now = new Date();

    const ds = app.get(DataSource);
    const orphanStudent = await ds.getRepository(StudentEntity).save({
      id: randomUUID(),
      name: `Orphan ${suffix}`,
      email,
      status: 'active',
      lessonBalance: 0,
      userId: null,
    });

    await ds.getRepository(UserEntity).save({
      id: userId,
      email,
      passwordHash: bcrypt.hashSync('TestPass123!', 10),
      role: '',
      status: 'active',
      emailVerified: true,
      verificationCode: null,
      verificationCodeExpiresAt: null,
      verificationCodeSentAt: null,
      verificationAttempts: 0,
      firstName: 'Orphan',
      lastName: 'Link',
      phone: '',
      telegramId: '',
      telegramUsername: '',
      telegramLinkToken: null,
      telegramLinkExpires: null,
      createdDate: now,
      updatedDate: now,
    });

    await api(app)
      .patch(`/api/users/${userId}`)
      .set(authHeader(adminToken))
      .send({ role: 'student', status: 'active' })
      .expect(200);

    const linked = await ds.getRepository(StudentEntity).findOne({
      where: { id: orphanStudent.id },
    });
    expect(linked?.userId).toBe(userId);
    expect(
      await ds.getRepository(StudentEntity).count({ where: { email } }),
    ).toBe(1);
  });

  it('assigns tutor role and creates a single tutor profile', async () => {
    const suffix = randomUUID().slice(0, 8);
    const email = `tutor-role-${suffix}@test.local`;
    const userId = randomUUID();
    const now = new Date();

    const ds = app.get(DataSource);
    await ds.getRepository(UserEntity).save({
      id: userId,
      email,
      passwordHash: bcrypt.hashSync('TestPass123!', 10),
      role: '',
      status: 'active',
      emailVerified: true,
      verificationCode: null,
      verificationCodeExpiresAt: null,
      verificationCodeSentAt: null,
      verificationAttempts: 0,
      firstName: 'Tutor',
      lastName: 'Role',
      phone: '',
      telegramId: '',
      telegramUsername: '',
      telegramLinkToken: null,
      telegramLinkExpires: null,
      createdDate: now,
      updatedDate: now,
    });

    const patchRes = await api(app)
      .patch(`/api/users/${userId}`)
      .set(authHeader(adminToken))
      .send({ role: 'tutor', status: 'active' })
      .expect(200);

    expect(patchRes.body.role).toBe('tutor');
    expect(patchRes.body.onboarding_state).toBe('active');
    expect(patchRes.body.redirect_path).toBe('/TutorDashboard');

    const { TutorEntity } = await import('../src/modules/tutors/entities/tutor.entity');
    const tutors = await ds.getRepository(TutorEntity).find({ where: { userId } });
    expect(tutors).toHaveLength(1);
    expect(tutors[0].status).toBe('active');
    expect(tutors[0].email).toBe(email);

    const tutorsRes = await api(app)
      .get('/api/tutors')
      .set(authHeader(adminToken))
      .expect(200);
    expect(tutorsRes.body.some((row: { id: string }) => row.id === tutors[0].id)).toBe(true);

    // Re-assign same role must not create a duplicate profile.
    await api(app)
      .patch(`/api/users/${userId}`)
      .set(authHeader(adminToken))
      .send({ role: 'tutor', status: 'active' })
      .expect(200);
    expect(await ds.getRepository(TutorEntity).count({ where: { userId } })).toBe(1);
  });
});
