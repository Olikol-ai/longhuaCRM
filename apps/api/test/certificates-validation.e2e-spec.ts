import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import {
  adminLogin,
  api,
  authHeader,
  createTestApp,
  ensureDatabaseReady,
  login,
} from './e2e-helpers';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

async function createStudentUser(
  app: INestApplication,
  adminToken: string,
  label: string,
): Promise<{ studentId: string; token: string; email: string }> {
  const ds = app.get(DataSource);
  const userId = randomUUID();
  const email = `${label}-${randomUUID().slice(0, 8)}@test.local`;
  const password = 'StudentPass123!';
  const now = new Date();

  await ds.getRepository(UserEntity).save({
    id: userId,
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    role: 'student',
    status: 'active',
    emailVerified: true,
    verificationCode: null,
    verificationCodeExpiresAt: null,
    verificationCodeSentAt: null,
    verificationAttempts: 0,
    firstName: 'Cert',
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
    .send({ name: `Certificate Student ${label}`, userId, status: 'active' })
    .expect(201);

  const session = await login(app, email, password);
  return { studentId: studentRes.body.id, token: session.token, email };
}

async function seedCompletedEnrollment(
  app: INestApplication,
  adminToken: string,
  studentId: string,
): Promise<{ courseId: string }> {
  const courseRes = await api(app)
    .post('/api/courses')
    .set(authHeader(adminToken))
    .send({
      name: `Cert Course ${randomUUID().slice(0, 8)}`,
      courseType: 'basic_beginner',
      totalLessons: 1,
    })
    .expect(201);

  await api(app)
    .post('/api/courses/enrollments')
    .set(authHeader(adminToken))
    .send({
      studentId,
      courseTemplateId: courseRes.body.id,
      totalLessons: 1,
      completedLessons: 1,
      status: 'completed',
    })
    .expect(201);

  return { courseId: courseRes.body.id };
}

describeE2E('Certificates validation (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    await ensureDatabaseReady();
    app = await createTestApp();
    const admin = await adminLogin(app);
    adminToken = admin.token;
  }, 120000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('creates draft certificate and records history', async () => {
    const student = await createStudentUser(app, adminToken, 'create');
    const { courseId } = await seedCompletedEnrollment(app, adminToken, student.studentId);
    const registrationNumber = `REG-${randomUUID().slice(0, 8)}`;

    const created = await api(app)
      .post('/api/certificates')
      .set(authHeader(adminToken))
      .send({
        studentId: student.studentId,
        courseId,
        registrationNumber,
        blankSeries: 'LH',
        blankNumber: '10001',
        status: 'draft',
      })
      .expect(201);

    expect(created.body.status).toBe('draft');

    const history = await api(app)
      .get(`/api/certificates/${created.body.id}/history`)
      .set(authHeader(adminToken))
      .expect(200);

    expect(history.body.some((row) => row.action === 'created')).toBe(true);
  });

  it('rejects duplicate registration number', async () => {
    const student = await createStudentUser(app, adminToken, 'dup-reg');
    const { courseId } = await seedCompletedEnrollment(app, adminToken, student.studentId);
    const registrationNumber = `DUP-${randomUUID().slice(0, 8)}`;

    await api(app)
      .post('/api/certificates')
      .set(authHeader(adminToken))
      .send({
        studentId: student.studentId,
        courseId,
        registrationNumber,
        blankSeries: 'LH',
        blankNumber: '20001',
        status: 'draft',
      })
      .expect(201);

    const student2 = await createStudentUser(app, adminToken, 'dup-reg-2');
    const enrollment2 = await seedCompletedEnrollment(app, adminToken, student2.studentId);

    const duplicate = await api(app)
      .post('/api/certificates')
      .set(authHeader(adminToken))
      .send({
        studentId: student2.studentId,
        courseId: enrollment2.courseId,
        registrationNumber,
        blankSeries: 'LH',
        blankNumber: '20002',
        status: 'draft',
      });

    expect(duplicate.status).toBe(409);
  });

  it('rejects duplicate blank series and number', async () => {
    const student = await createStudentUser(app, adminToken, 'dup-blank');
    const { courseId } = await seedCompletedEnrollment(app, adminToken, student.studentId);

    await api(app)
      .post('/api/certificates')
      .set(authHeader(adminToken))
      .send({
        studentId: student.studentId,
        courseId,
        registrationNumber: `REG-A-${randomUUID().slice(0, 8)}`,
        blankSeries: 'SER',
        blankNumber: '90001',
        status: 'draft',
      })
      .expect(201);

    const student2 = await createStudentUser(app, adminToken, 'dup-blank-2');
    const enrollment2 = await seedCompletedEnrollment(app, adminToken, student2.studentId);

    const duplicate = await api(app)
      .post('/api/certificates')
      .set(authHeader(adminToken))
      .send({
        studentId: student2.studentId,
        courseId: enrollment2.courseId,
        registrationNumber: `REG-B-${randomUUID().slice(0, 8)}`,
        blankSeries: 'SER',
        blankNumber: '90001',
        status: 'draft',
      });

    expect(duplicate.status).toBe(409);
  });

  it('blocks modification of issued certificate identity fields', async () => {
    const student = await createStudentUser(app, adminToken, 'issued-lock');
    const { courseId } = await seedCompletedEnrollment(app, adminToken, student.studentId);

    const draft = await api(app)
      .post('/api/certificates')
      .set(authHeader(adminToken))
      .send({
        studentId: student.studentId,
        courseId,
        registrationNumber: `ISS-${randomUUID().slice(0, 8)}`,
        blankSeries: 'LH',
        blankNumber: '30001',
        status: 'draft',
      })
      .expect(201);

    const issued = await api(app)
      .patch(`/api/certificates/${draft.body.id}`)
      .set(authHeader(adminToken))
      .send({
        status: 'issued',
        issueDate: new Date().toISOString().split('T')[0],
      })
      .expect(200);

    expect(issued.body.status).toBe('issued');

    const blocked = await api(app)
      .patch(`/api/certificates/${draft.body.id}`)
      .set(authHeader(adminToken))
      .send({ registrationNumber: 'NEW-REG-NUMBER' });

    expect(blocked.status).toBe(400);
  });

  it('reissues certificate and preserves history on both records', async () => {
    const student = await createStudentUser(app, adminToken, 'reissue');
    const { courseId } = await seedCompletedEnrollment(app, adminToken, student.studentId);

    const draft = await api(app)
      .post('/api/certificates')
      .set(authHeader(adminToken))
      .send({
        studentId: student.studentId,
        courseId,
        registrationNumber: `REI-${randomUUID().slice(0, 8)}`,
        blankSeries: 'LH',
        blankNumber: '40001',
        status: 'draft',
      })
      .expect(201);

    await api(app)
      .patch(`/api/certificates/${draft.body.id}`)
      .set(authHeader(adminToken))
      .send({
        status: 'issued',
        issueDate: new Date().toISOString().split('T')[0],
      })
      .expect(200);

    const reissued = await api(app)
      .post(`/api/certificates/${draft.body.id}/reissue`)
      .set(authHeader(adminToken))
      .send({
        registrationNumber: `REI2-${randomUUID().slice(0, 8)}`,
        blankSeries: 'LH',
        blankNumber: '40002',
      })
      .expect(201);

    expect(reissued.body.status).toBe('issued');

    const original = await api(app)
      .get(`/api/certificates/${draft.body.id}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(original.body.status).toBe('duplicate');

    const originalHistory = await api(app)
      .get(`/api/certificates/${draft.body.id}/history`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(originalHistory.body.some((row) => row.action === 'reissued')).toBe(true);

    const newHistory = await api(app)
      .get(`/api/certificates/${reissued.body.id}/history`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(newHistory.body.some((row) => row.action === 'reissue_created')).toBe(true);
  });

  it('denies PDF download for another student certificate', async () => {
    const studentA = await createStudentUser(app, adminToken, 'pdf-a');
    const studentB = await createStudentUser(app, adminToken, 'pdf-b');
    const { courseId } = await seedCompletedEnrollment(app, adminToken, studentA.studentId);

    const draft = await api(app)
      .post('/api/certificates')
      .set(authHeader(adminToken))
      .send({
        studentId: studentA.studentId,
        courseId,
        registrationNumber: `PDF-${randomUUID().slice(0, 8)}`,
        blankSeries: 'LH',
        blankNumber: '50001',
        status: 'draft',
      })
      .expect(201);

    await api(app)
      .patch(`/api/certificates/${draft.body.id}`)
      .set(authHeader(adminToken))
      .send({
        status: 'issued',
        issueDate: new Date().toISOString().split('T')[0],
      })
      .expect(200);

    const forbidden = await api(app)
      .get(`/api/certificates/${draft.body.id}/pdf`)
      .set(authHeader(studentB.token));

    expect(forbidden.status).toBe(403);
  });

  it('rejects invalid status transition', async () => {
    const student = await createStudentUser(app, adminToken, 'transition');
    const { courseId } = await seedCompletedEnrollment(app, adminToken, student.studentId);

    const draft = await api(app)
      .post('/api/certificates')
      .set(authHeader(adminToken))
      .send({
        studentId: student.studentId,
        courseId,
        registrationNumber: `TR-${randomUUID().slice(0, 8)}`,
        blankSeries: 'LH',
        blankNumber: '60001',
        status: 'draft',
      })
      .expect(201);

    const blocked = await api(app)
      .patch(`/api/certificates/${draft.body.id}`)
      .set(authHeader(adminToken))
      .send({ status: 'sent' });

    expect(blocked.status).toBe(400);
  });
});
