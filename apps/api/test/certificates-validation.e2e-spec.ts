import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import {
  adminLogin,
  api,
  authHeader,
  createTeacherUser,
  createTestApp,
  ensureDatabaseReady,
  login,
} from './e2e-helpers';
import { CertificateHistoryEntity } from '../src/modules/certificates/entities/certificate-history.entity';
import { CertificateEntity } from '../src/modules/certificates/entities/certificate.entity';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

function uniqueBlankNumber(): string {
  return randomUUID().replace(/-/g, '').slice(0, 8);
}

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
    const blankNumber = uniqueBlankNumber();

    const created = await api(app)
      .post('/api/certificates')
      .set(authHeader(adminToken))
      .send({
        studentId: student.studentId,
        courseId,
        registrationNumber,
        blankSeries: 'LH',
        blankNumber,
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
        blankNumber: uniqueBlankNumber(),
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
        blankNumber: uniqueBlankNumber(),
        status: 'draft',
      });

    expect(duplicate.status).toBe(409);
  });

  it('rejects duplicate blank series and number', async () => {
    const student = await createStudentUser(app, adminToken, 'dup-blank');
    const { courseId } = await seedCompletedEnrollment(app, adminToken, student.studentId);

    const sharedBlankNumber = uniqueBlankNumber();

    await api(app)
      .post('/api/certificates')
      .set(authHeader(adminToken))
      .send({
        studentId: student.studentId,
        courseId,
        registrationNumber: `REG-A-${randomUUID().slice(0, 8)}`,
        blankSeries: 'SER',
        blankNumber: sharedBlankNumber,
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
        blankNumber: sharedBlankNumber,
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
        blankNumber: uniqueBlankNumber(),
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
        blankNumber: uniqueBlankNumber(),
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
        blankNumber: uniqueBlankNumber(),
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

  it('sends in-app celebration notification when certificate is issued', async () => {
    const student = await createStudentUser(app, adminToken, 'notify');
    const { courseId } = await seedCompletedEnrollment(app, adminToken, student.studentId);

    const draft = await api(app)
      .post('/api/certificates')
      .set(authHeader(adminToken))
      .send({
        studentId: student.studentId,
        courseId,
        registrationNumber: `NTF-${randomUUID().slice(0, 8)}`,
        blankSeries: 'LH',
        blankNumber: uniqueBlankNumber(),
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

    // Notifier is async fire-and-forget — poll briefly
    type NoteRow = {
      type?: string;
      reference_id?: string;
      channel?: string;
      title?: string;
      body?: string;
    };
    let notes: NoteRow[] = [];
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const res = await api(app)
        .get('/api/notifications')
        .set(authHeader(student.token))
        .expect(200);
      notes = ((res.body || []) as NoteRow[]).filter(
        (n) =>
          n.type === 'certificate_issued' &&
          n.channel === 'in_app' &&
          n.reference_id === draft.body.id,
      );
      if (notes.length > 0) break;
      await new Promise((r) => setTimeout(r, 50));
    }

    expect(notes.length).toBeGreaterThan(0);
    expect(notes[0].title).toContain('достижение');
    expect(notes[0].body).toMatch(/серия|Серия/i);
    expect(notes[0].body).toMatch(/номер|Номер/i);
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
        blankNumber: uniqueBlankNumber(),
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
        blankNumber: uniqueBlankNumber(),
        status: 'draft',
      })
      .expect(201);

    const blocked = await api(app)
      .patch(`/api/certificates/${draft.body.id}`)
      .set(authHeader(adminToken))
      .send({ status: 'sent' });

    expect(blocked.status).toBe(400);
  });

  it('admin hard-deletes certificate including history; teacher cannot delete', async () => {
    const student = await createStudentUser(app, adminToken, 'del-cert');
    const { courseId } = await seedCompletedEnrollment(app, adminToken, student.studentId);

    const draft = await api(app)
      .post('/api/certificates')
      .set(authHeader(adminToken))
      .send({
        studentId: student.studentId,
        courseId,
        registrationNumber: `DEL-${randomUUID().slice(0, 8)}`,
        blankSeries: 'LH',
        blankNumber: uniqueBlankNumber(),
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

    const teacher = await createTeacherUser(app, adminToken, {
      email: `cert-del-t-${randomUUID().slice(0, 8)}@test.local`,
      password: 'TeacherPass123!',
      name: `Cert Del Teacher ${randomUUID().slice(0, 8)}`,
    });

    await api(app)
      .delete(`/api/certificates/${draft.body.id}`)
      .set(authHeader(teacher.token))
      .expect(403);

    const deleted = await api(app)
      .delete(`/api/certificates/${draft.body.id}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(deleted.body.success).toBe(true);

    await api(app)
      .get(`/api/certificates/${draft.body.id}`)
      .set(authHeader(adminToken))
      .expect(404);

    const ds = app.get(DataSource);
    const cert = await ds.getRepository(CertificateEntity).findOne({
      where: { id: draft.body.id },
    });
    expect(cert).toBeNull();

    const history = await ds.getRepository(CertificateHistoryEntity).find({
      where: { certificateId: draft.body.id },
    });
    expect(history).toHaveLength(0);
  });

  it('public verify endpoint confirms issued certificate without auth', async () => {
    const student = await createStudentUser(app, adminToken, 'verify');
    const { courseId } = await seedCompletedEnrollment(app, adminToken, student.studentId);
    const registrationNumber = `VR-${randomUUID().slice(0, 8)}`;
    const issueDate = new Date().toISOString().split('T')[0];

    const created = await api(app)
      .post('/api/certificates')
      .set(authHeader(adminToken))
      .send({
        studentId: student.studentId,
        courseId,
        registrationNumber,
        blankSeries: 'LH',
        blankNumber: uniqueBlankNumber(),
        status: 'draft',
      })
      .expect(201);

    await api(app)
      .patch(`/api/certificates/${created.body.id}`)
      .set(authHeader(adminToken))
      .send({ status: 'issued', issueDate })
      .expect(200);

    const verifyRes = await api(app)
      .get(`/api/certificates/${created.body.id}/verify`)
      .expect(200);

    expect(verifyRes.body.valid).toBe(true);
    expect(verifyRes.body.registration_number).toBe(registrationNumber);
    expect(verifyRes.body.issuer?.director).toBe('Янчиленко И.А.');
    expect(verifyRes.body.issuer?.organization).toContain('ДатаВэйв');

    await api(app)
      .get(`/api/certificates/${randomUUID()}/verify`)
      .expect(404);
  });
});
