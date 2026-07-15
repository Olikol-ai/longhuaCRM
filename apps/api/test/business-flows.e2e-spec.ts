import { INestApplication } from '@nestjs/common';
import * as crypto from 'crypto';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import {
  adminLogin,
  api,
  authHeader,
  createTeacherUser,
  createTestApp,
  dayOfWeekForDate,
  futureLessonDate,
  ensureDatabaseReady,
  login,
  setPendingVerificationCode,
} from './e2e-helpers';
import { DataSource } from 'typeorm';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { StudentEntity } from '../src/modules/students/entities/student.entity';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

function uniqueBlankNumber(): string {
  return randomUUID().replace(/-/g, '').slice(0, 8);
}

async function createStudentWithUser(
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
    lastName: label,
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

  const studentRes = await api(app)
    .post('/api/students')
    .set(authHeader(adminToken))
    .send({ name: `Student ${label}`, userId, email, status: 'active' })
    .expect(201);

  const session = await login(app, email, password);
  return { studentId: studentRes.body.id, token: session.token, email };
}

describeE2E('LongHuaCRM business flows (e2e)', () => {
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

  describe('Auth', () => {
    it('rejects weak registration password with Russian policy message', async () => {
      const email = `weak-pass-${randomUUID()}@test.local`;

      const res = await api(app)
        .post('/api/auth/register')
        .send({
          email,
          password: 'пароль123',
          first_name: 'Weak',
          last_name: 'Pass',
        })
        .expect(400);

      const message = Array.isArray(res.body.message)
        ? res.body.message.join(' ')
        : String(res.body.message ?? '');
      expect(message).toMatch(/латинск/i);
      expect(message).toMatch(/цифр/i);
    });

    it('registers a pending user and completes verification', async () => {
      const email = `student-${randomUUID()}@test.local`;
      const password = 'SecurePass123!';

      const registerRes = await api(app)
        .post('/api/auth/register')
        .send({
          email,
          password,
          first_name: 'E2E',
          last_name: 'Student',
        })
        .expect(201);

      expect(registerRes.body.pending).toBe(true);
      expect(registerRes.body.email).toBe(email);

      const verifyCode = '654321';
      await setPendingVerificationCode(app, email, verifyCode);

      const verifyRes = await api(app)
        .post('/api/auth/verify-registration')
        .send({ email, code: verifyCode })
        .expect(201);

      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.email).toBe(email);
      expect(verifyRes.body.token).toBeFalsy();
      expect(verifyRes.body.role === '' || verifyRes.body.role == null).toBe(true);

      const loginRes = await api(app).post('/api/auth/login').send({ email, password }).expect(201);
      expect(loginRes.body.token).toBeTruthy();
      expect(loginRes.body.user?.email).toBe(email);
      expect(
        loginRes.body.user?.role === '' ||
          loginRes.body.user?.role == null ||
          loginRes.body.user?.onboarding_state === 'awaiting_role',
      ).toBe(true);
    });

    it('assigns student role when wantsStudentRole is true and ignores client role fields', async () => {
      const email = `auto-student-${randomUUID()}@test.local`;
      const password = 'SecurePass123!';

      await api(app)
        .post('/api/auth/register')
        .send({
          email,
          password,
          first_name: 'Auto',
          last_name: 'Student',
          wantsStudentRole: true,
          role: 'admin',
          roles: ['admin'],
          roleId: 'fake',
        })
        .expect(201);

      const verifyCode = '654321';
      await setPendingVerificationCode(app, email, verifyCode);

      const verifyRes = await api(app)
        .post('/api/auth/verify-registration')
        .send({ email, code: verifyCode })
        .expect(201);

      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.role).toBe('student');
      expect(verifyRes.body.token).toBeFalsy();
      expect(verifyRes.body.message).toMatch(/успешно/i);

      const loginRes = await api(app).post('/api/auth/login').send({ email, password }).expect(201);
      expect(loginRes.body.user?.role).toBe('student');

      const studentsRes = await api(app)
        .get('/api/students')
        .set(authHeader(adminToken))
        .expect(200);
      const profile = studentsRes.body.find(
        (row: { email?: string; user_id?: string }) => row.email === email,
      );
      expect(profile).toBeTruthy();
      expect(profile.user_id).toBeTruthy();
    });

    it('treats duplicate verify as idempotent success without duplicate users or students', async () => {
      const email = `idempotent-${randomUUID()}@test.local`;
      const password = 'SecurePass123!';

      await api(app)
        .post('/api/auth/register')
        .send({
          email,
          password,
          first_name: 'Idem',
          last_name: 'Student',
          wantsStudentRole: true,
        })
        .expect(201);

      const verifyCode = '654321';
      await setPendingVerificationCode(app, email, verifyCode);

      const first = await api(app)
        .post('/api/auth/verify-registration')
        .send({ email, code: verifyCode })
        .expect(201);
      expect(first.body.success).toBe(true);
      expect(first.body.role).toBe('student');

      const second = await api(app)
        .post('/api/auth/verify-registration')
        .send({ email, code: verifyCode })
        .expect(201);
      expect(second.body.success).toBe(true);
      expect(second.body.role).toBe('student');
      expect(second.body.token).toBeFalsy();

      const ds = app.get(DataSource);
      const users = await ds.getRepository(UserEntity).find({ where: { email } });
      expect(users).toHaveLength(1);
      expect(users[0].emailVerified).toBe(true);
      expect(users[0].role).toBe('student');

      const students = await ds.getRepository(StudentEntity).find({ where: { email } });
      expect(students).toHaveLength(1);
      expect(students[0].userId).toBe(users[0].id);
    });

    it('rejects expired verification code without creating a user', async () => {
      const email = `expired-code-${randomUUID()}@test.local`;
      const password = 'SecurePass123!';

      await api(app)
        .post('/api/auth/register')
        .send({
          email,
          password,
          first_name: 'Expired',
          last_name: 'Code',
        })
        .expect(201);

      await setPendingVerificationCode(app, email, '654321', {
        codeExpiresAt: new Date(Date.now() - 60_000),
      });

      const verifyRes = await api(app)
        .post('/api/auth/verify-registration')
        .send({ email, code: '654321' })
        .expect(400);

      expect(String(verifyRes.body.message)).toMatch(/истёк/i);

      const ds = app.get(DataSource);
      const users = await ds.getRepository(UserEntity).find({ where: { email } });
      expect(users).toHaveLength(0);
    });

    it('logs in as seeded admin', async () => {
      const res = await api(app)
        .post('/api/auth/login')
        .send({
          email: process.env.ADMIN_EMAIL,
          password: process.env.ADMIN_PASSWORD,
        })
        .expect(201);

      expect(res.body.token).toBeTruthy();
      expect(res.body.user?.role).toBe('admin');
    });

    it('assigns assigned_teacher from teacher invite token on verify', async () => {
      const teacher = await createTeacherUser(app, adminToken, {
        email: `invite-teacher-${randomUUID()}@test.local`,
        password: 'TeacherPass123!',
        name: 'Invite Teacher',
      });

      const inviteRes = await api(app)
        .post('/api/teacher-invites')
        .set(authHeader(teacher.token))
        .send({})
        .expect(201);

      expect(inviteRes.body.token).toBeTruthy();
      expect(String(inviteRes.body.path)).toContain('/register?ref=');

      const email = `invited-student-${randomUUID()}@test.local`;
      const password = 'SecurePass123!';

      await api(app)
        .post('/api/auth/register')
        .send({
          email,
          password,
          first_name: 'Invited',
          last_name: 'Student',
          inviteToken: inviteRes.body.token,
          role: 'admin',
        })
        .expect(201);

      await setPendingVerificationCode(app, email, '654321');

      const verifyRes = await api(app)
        .post('/api/auth/verify-registration')
        .send({ email, code: '654321' })
        .expect(201);

      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.role).toBe('student');

      const ds = app.get(DataSource);
      const student = await ds.getRepository(StudentEntity).findOne({ where: { email } });
      expect(student).toBeTruthy();
      expect(student?.assignedTeacherId).toBe(teacher.teacherId);
    });
  });

  describe('Teacher materials', () => {
    it('enforces owner checks: B cannot read/edit/delete A material; admin can', async () => {
      const teacherA = await createTeacherUser(app, adminToken, {
        email: `mat-a-${randomUUID()}@test.local`,
        password: 'TeacherPass123!',
        name: 'Material Teacher A',
      });
      const teacherB = await createTeacherUser(app, adminToken, {
        email: `mat-b-${randomUUID()}@test.local`,
        password: 'TeacherPass123!',
        name: 'Material Teacher B',
      });

      const courseRes = await api(app)
        .post('/api/courses')
        .set(authHeader(adminToken))
        .send({
          name: `Mat Course ${randomUUID().slice(0, 8)}`,
          courseType: 'basic_beginner',
          totalLessons: 10,
        })
        .expect(201);

      const folderRes = await api(app)
        .post('/api/materials/folders')
        .set(authHeader(teacherA.token))
        .send({
          name: 'Folder A',
          courseTemplateId: courseRes.body.id,
        })
        .expect(201);

      const materialRes = await api(app)
        .post('/api/materials')
        .set(authHeader(teacherA.token))
        .send({
          title: `Teacher Material ${randomUUID().slice(0, 6)}`,
          folderId: folderRes.body.id,
          fileType: 'link',
          fileUrl: 'https://example.com/lesson',
        })
        .expect(201);

      const materialId = materialRes.body.id as string;
      expect(materialRes.body.created_by_user_id || materialRes.body.createdByUserId).toBeTruthy();

      // Owner can read
      await api(app)
        .get(`/api/materials/${materialId}`)
        .set(authHeader(teacherA.token))
        .expect(200);

      // Teacher B: no material_access → cannot open by URL id
      await api(app)
        .get(`/api/materials/${materialId}`)
        .set(authHeader(teacherB.token))
        .expect(403);

      // Teacher B: cannot edit title
      await api(app)
        .patch(`/api/materials/${materialId}`)
        .set(authHeader(teacherB.token))
        .send({ title: 'Hacked' })
        .expect(403);

      // Teacher B: cannot replace file_url
      await api(app)
        .patch(`/api/materials/${materialId}`)
        .set(authHeader(teacherB.token))
        .send({ fileUrl: 'https://evil.example/steal' })
        .expect(403);

      // Teacher B: cannot delete
      await api(app)
        .delete(`/api/materials/${materialId}`)
        .set(authHeader(teacherB.token))
        .expect(403);

      // Signed file URL also denied without access
      const signedB = await api(app)
        .get(`/api/files/material/${materialId}/url`)
        .set(authHeader(teacherB.token))
        .expect(200);
      expect(signedB.body.url).toBeNull();

      // List isolation
      const listB = await api(app)
        .get('/api/materials')
        .set(authHeader(teacherB.token))
        .expect(200);
      expect(listB.body.some((m: { id: string }) => m.id === materialId)).toBe(false);

      // Admin can read and update
      await api(app)
        .get(`/api/materials/${materialId}`)
        .set(authHeader(adminToken))
        .expect(200);

      await api(app)
        .patch(`/api/materials/${materialId}`)
        .set(authHeader(adminToken))
        .send({ title: 'Admin Updated' })
        .expect(200);

      // Owner can still delete own material
      await api(app)
        .delete(`/api/materials/${materialId}`)
        .set(authHeader(teacherA.token))
        .expect(200);
    });
  });

  describe('Student flow', () => {
    it('creates student, enrollment, group, lesson, and attendance', async () => {
      const courseRes = await api(app)
        .post('/api/courses')
        .set(authHeader(adminToken))
        .send({
          name: `E2E Course ${randomUUID().slice(0, 8)}`,
          courseType: 'basic_beginner',
          totalLessons: 10,
        })
        .expect(201);

      const studentRes = await api(app)
        .post('/api/students')
        .set(authHeader(adminToken))
        .send({ name: `E2E Student ${randomUUID().slice(0, 8)}`, status: 'active' })
        .expect(201);

      const teacher = await createTeacherUser(app, adminToken, {
        email: `teacher-${randomUUID()}@test.local`,
        password: 'TeacherPass123!',
        name: 'E2E Teacher',
      });

      const enrollmentRes = await api(app)
        .post('/api/courses/enrollments')
        .set(authHeader(adminToken))
        .send({
          studentId: studentRes.body.id,
          courseTemplateId: courseRes.body.id,
          totalLessons: 10,
          status: 'active',
        })
        .expect(201);

      const groupRes = await api(app)
        .post('/api/groups')
        .set(authHeader(adminToken))
        .send({
          name: `E2E Group ${randomUUID().slice(0, 8)}`,
          teacherId: teacher.teacherId,
        })
        .expect(201);

      await api(app)
        .post(`/api/groups/${groupRes.body.id}/members`)
        .set(authHeader(adminToken))
        .send({ studentId: studentRes.body.id })
        .expect(201);

      const lessonDate = futureLessonDate(10);
      await api(app)
        .post('/api/schedule')
        .set(authHeader(adminToken))
        .send({
          teacherId: teacher.teacherId,
          dayOfWeek: dayOfWeekForDate(lessonDate),
          timeFrom: '10:00',
          timeTo: '18:00',
        })
        .expect(201);

      const lessonRes = await api(app)
        .post('/api/lessons')
        .set(authHeader(adminToken))
        .send({
          teacherId: teacher.teacherId,
          groupId: groupRes.body.id,
          primaryStudentId: studentRes.body.id,
          date: lessonDate,
          startTime: '11:00',
          duration: 60,
        })
        .expect(201);

      const attendanceRes = await api(app)
        .post('/api/lessons/attendance/filter')
        .set(authHeader(adminToken))
        .send({ where: { lesson_id: lessonRes.body.id } })
        .expect(201);

      expect(attendanceRes.body.length).toBeGreaterThan(0);
      expect(attendanceRes.body[0].attendance_status).toBe('enrolled');

      const progressRes = await api(app)
        .get(`/api/courses/enrollments/${enrollmentRes.body.id}/progress`)
        .set(authHeader(adminToken))
        .expect(200);

      expect(progressRes.body.total_lessons).toBe(10);
      expect(progressRes.body.completed_lessons).toBe(0);
      expect(progressRes.body.remaining_lessons).toBe(10);
    });
  });

  describe('Teacher flow', () => {
    it('allows teacher access, lesson completion, and teacher payments', async () => {
      const teacher = await createTeacherUser(app, adminToken, {
        email: `teacher-flow-${randomUUID()}@test.local`,
        password: 'TeacherPass123!',
        name: 'Flow Teacher',
      });

      const studentRes = await api(app)
        .post('/api/students')
        .set(authHeader(adminToken))
        .send({ name: `Teacher Flow Student ${randomUUID().slice(0, 8)}` })
        .expect(201);

      const lessonDate = futureLessonDate(12);
      await api(app)
        .post('/api/schedule')
        .set(authHeader(adminToken))
        .send({
          teacherId: teacher.teacherId,
          dayOfWeek: dayOfWeekForDate(lessonDate),
          timeFrom: '09:00',
          timeTo: '17:00',
        })
        .expect(201);

      const lessonRes = await api(app)
        .post('/api/lessons')
        .set(authHeader(adminToken))
        .send({
          teacherId: teacher.teacherId,
          primaryStudentId: studentRes.body.id,
          date: lessonDate,
          startTime: '10:00',
          duration: 60,
        })
        .expect(201);

      await api(app)
        .patch(`/api/lessons/${lessonRes.body.id}/complete`)
        .set(authHeader(teacher.token))
        .expect(200);

      const myPaymentsRes = await api(app)
        .get('/api/teacher-payments/my')
        .set(authHeader(teacher.token))
        .expect(200);

      expect(Array.isArray(myPaymentsRes.body)).toBe(true);
      expect(myPaymentsRes.body.some((row) => row.lesson_id === lessonRes.body.id)).toBe(true);
    });
  });

  describe('Payment flow', () => {
    it('accepts offline payment request', async () => {
      const ds = app.get(DataSource);
      const userId = randomUUID();
      const now = new Date();
      const email = `pay-student-${randomUUID()}@test.local`;
      const password = 'StudentPass123!';

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
        firstName: 'Pay',
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
        .send({ name: 'Payment Student', userId, status: 'active' })
        .expect(201);

      const loginRes = await api(app).post('/api/auth/login').send({ email, password }).expect(201);

      const offlineRes = await api(app)
        .post('/api/alfabank/offline-payment-request')
        .set(authHeader(loginRes.body.token))
        .send({
          student_id: studentRes.body.id,
          item_label: '10 lessons package',
          amount: 120,
          method: 'cash',
        })
        .expect(201);

      expect(offlineRes.body.ok).toBe(true);
      expect(offlineRes.body.saved).toBe(true);
    });

    it('processes AlfaBank webhook for pending payment', async () => {
      const studentRes = await api(app)
        .post('/api/students')
        .set(authHeader(adminToken))
        .send({ name: `Webhook Student ${randomUUID().slice(0, 8)}` })
        .expect(201);

      const orderNumber = `E2E-${randomUUID().slice(0, 8)}`;
      const orderId = randomUUID();
      const amountKopecks = '15000';
      const alfaToken = 'e2e-test-alfa-token';

      await api(app)
        .post('/api/payments')
        .set(authHeader(adminToken))
        .send({
          studentId: studentRes.body.id,
          amount: 150,
          status: 'pending',
          provider: 'alfa_bank',
          orderNumber,
          lessonsAdded: 5,
          currency: 'BYN',
        })
        .expect(201);

      const checksum = crypto
        .createHash('md5')
        .update(`${orderId};${amountKopecks};810;${alfaToken}`)
        .digest('hex');

      const webhookBody = new URLSearchParams({
        orderId,
        orderNumber,
        amount: amountKopecks,
        status: '1',
        checksum,
      }).toString();

      const webhookRes = await api(app)
        .post('/api/webhooks/alfabank')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(webhookBody);

      expect(webhookRes.status).toBeGreaterThanOrEqual(200);
      expect(webhookRes.status).toBeLessThan(300);
      expect(webhookRes.text).toBe('1');

      const student = await app.get(DataSource).getRepository(StudentEntity).findOne({
        where: { id: studentRes.body.id },
      });
      expect(student?.lessonBalance).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Certificate flow', () => {
    it('creates draft, issues certificate, and returns PDF', async () => {
      const courseRes = await api(app)
        .post('/api/courses')
        .set(authHeader(adminToken))
        .send({
          name: `Cert Course ${randomUUID().slice(0, 8)}`,
          courseType: 'advanced',
          totalLessons: 1,
        })
        .expect(201);

      const studentRes = await api(app)
        .post('/api/students')
        .set(authHeader(adminToken))
        .send({ name: `Cert Student ${randomUUID().slice(0, 8)}` })
        .expect(201);

      await api(app)
        .post('/api/courses/enrollments')
        .set(authHeader(adminToken))
        .send({
          studentId: studentRes.body.id,
          courseTemplateId: courseRes.body.id,
          totalLessons: 1,
          completedLessons: 1,
          status: 'completed',
        })
        .expect(201);

      const draftRes = await api(app)
        .post('/api/certificates')
        .set(authHeader(adminToken))
        .send({
          studentId: studentRes.body.id,
          courseId: courseRes.body.id,
          registrationNumber: `REG-${randomUUID().slice(0, 8)}`,
          blankSeries: 'LH',
          blankNumber: uniqueBlankNumber(),
          status: 'draft',
        })
        .expect(201);

      const issuedRes = await api(app)
        .patch(`/api/certificates/${draftRes.body.id}`)
        .set(authHeader(adminToken))
        .send({
          status: 'issued',
          issueDate: new Date().toISOString().split('T')[0],
        })
        .expect(200);

      expect(issuedRes.body.status).toBe('issued');

      const pdfRes = await api(app)
        .get(`/api/certificates/${draftRes.body.id}/pdf`)
        .set(authHeader(adminToken))
        .buffer()
        .parse((res, callback) => {
          const data: Buffer[] = [];
          res.on('data', (chunk) => data.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(data)));
        })
        .expect(200);

      expect(pdfRes.headers['content-type']).toContain('application/pdf');
      expect(pdfRes.body.length).toBeGreaterThan(100);
      expect(pdfRes.body.subarray(0, 4).toString()).toBe('%PDF');
    });

    it('issues without completed enrollment and isolates student list access', async () => {
      const courseRes = await api(app)
        .post('/api/courses')
        .set(authHeader(adminToken))
        .send({
          name: `Manual Cert ${randomUUID().slice(0, 8)}`,
          courseType: 'basic_beginner',
          totalLessons: 10,
        })
        .expect(201);

      const owner = await createStudentWithUser(app, adminToken, 'owner');
      const other = await createStudentWithUser(app, adminToken, 'other');

      const draftRes = await api(app)
        .post('/api/certificates')
        .set(authHeader(adminToken))
        .send({
          studentId: owner.studentId,
          courseId: courseRes.body.id,
          registrationNumber: `REG-${randomUUID().slice(0, 8)}`,
          blankSeries: 'MN',
          blankNumber: uniqueBlankNumber(),
          status: 'draft',
        })
        .expect(201);

      const issueDate = '2026-06-15';
      const issued = await api(app)
        .patch(`/api/certificates/${draftRes.body.id}`)
        .set(authHeader(adminToken))
        .send({ status: 'issued', issueDate })
        .expect(200);

      expect(issued.body.status).toBe('issued');
      expect(issued.body.issue_date || issued.body.issueDate).toBe(issueDate);

      const ownerList = await api(app)
        .get('/api/certificates')
        .set(authHeader(owner.token))
        .expect(200);
      expect(ownerList.body.some((c: { id: string }) => c.id === draftRes.body.id)).toBe(true);

      const otherList = await api(app)
        .get('/api/certificates')
        .set(authHeader(other.token))
        .expect(200);
      expect(otherList.body.some((c: { id: string }) => c.id === draftRes.body.id)).toBe(false);

      await api(app)
        .get(`/api/certificates/${draftRes.body.id}`)
        .set(authHeader(other.token))
        .expect(403);
    });

    it('archives course and annuls certificate without breaking history', async () => {
      const courseRes = await api(app)
        .post('/api/courses')
        .set(authHeader(adminToken))
        .send({
          name: `Archive Course ${randomUUID().slice(0, 8)}`,
          courseType: 'basic_beginner',
          totalLessons: 5,
        })
        .expect(201);

      const owner = await createStudentWithUser(app, adminToken, 'arch-owner');

      const draftRes = await api(app)
        .post('/api/certificates')
        .set(authHeader(adminToken))
        .send({
          studentId: owner.studentId,
          courseId: courseRes.body.id,
          registrationNumber: `REG-${randomUUID().slice(0, 8)}`,
          blankSeries: 'AR',
          blankNumber: uniqueBlankNumber(),
          status: 'draft',
        })
        .expect(201);

      await api(app)
        .patch(`/api/certificates/${draftRes.body.id}`)
        .set(authHeader(adminToken))
        .send({ status: 'issued', issueDate: '2026-07-01' })
        .expect(200);

      const archived = await api(app)
        .delete(`/api/courses/${courseRes.body.id}`)
        .set(authHeader(adminToken))
        .expect(200);

      expect(archived.body.is_active ?? archived.body.isActive).toBe(false);

      const list = await api(app)
        .get('/api/courses')
        .set(authHeader(adminToken))
        .expect(200);
      expect(list.body.some((c: { id: string }) => c.id === courseRes.body.id)).toBe(false);

      // Historical certificate row still readable by admin after course archive.
      await api(app)
        .get(`/api/certificates/${draftRes.body.id}`)
        .set(authHeader(adminToken))
        .expect(200);

      // Soft annulment (keeps row) — separate from hard DELETE.
      const annulled = await api(app)
        .patch(`/api/certificates/${draftRes.body.id}`)
        .set(authHeader(adminToken))
        .send({ status: 'revoked' })
        .expect(200);
      expect(annulled.body.status).toBe('revoked');

      const ownerList = await api(app)
        .get('/api/certificates')
        .set(authHeader(owner.token))
        .expect(200);
      const visible = ownerList.body.filter(
        (c: { id: string; status: string }) =>
          c.id === draftRes.body.id && (c.status === 'issued' || c.status === 'sent'),
      );
      expect(visible).toHaveLength(0);

      // Admin can hard-delete revoked certificate
      await api(app)
        .delete(`/api/certificates/${draftRes.body.id}`)
        .set(authHeader(adminToken))
        .expect(200);
      await api(app)
        .get(`/api/certificates/${draftRes.body.id}`)
        .set(authHeader(adminToken))
        .expect(404);

      // Draft hard-delete still works
      const course2 = await api(app)
        .post('/api/courses')
        .set(authHeader(adminToken))
        .send({
          name: `Draft Del ${randomUUID().slice(0, 8)}`,
          courseType: 'basic_beginner',
          totalLessons: 1,
        })
        .expect(201);
      const draft2 = await api(app)
        .post('/api/certificates')
        .set(authHeader(adminToken))
        .send({
          studentId: owner.studentId,
          courseId: course2.body.id,
          registrationNumber: `REG-${randomUUID().slice(0, 8)}`,
          status: 'draft',
        })
        .expect(201);
      await api(app)
        .delete(`/api/certificates/${draft2.body.id}`)
        .set(authHeader(adminToken))
        .expect(200);
      await api(app)
        .get(`/api/certificates/${draft2.body.id}`)
        .set(authHeader(adminToken))
        .expect(404);
    });
  });

  describe('Lesson cancellation', () => {
    it('cancels lesson, booking, and attendance', async () => {
      const teacher = await createTeacherUser(app, adminToken, {
        email: `cancel-${randomUUID()}@test.local`,
        password: 'TeacherPass123!',
        name: 'Cancel Teacher',
      });

      const studentRes = await api(app)
        .post('/api/students')
        .set(authHeader(adminToken))
        .send({ name: `Cancel Student ${randomUUID().slice(0, 8)}` })
        .expect(201);

      const lessonDate = futureLessonDate(14);
      await api(app)
        .post('/api/schedule')
        .set(authHeader(adminToken))
        .send({
          teacherId: teacher.teacherId,
          dayOfWeek: dayOfWeekForDate(lessonDate),
          timeFrom: '08:00',
          timeTo: '20:00',
        })
        .expect(201);

      const lessonRes = await api(app)
        .post('/api/lessons')
        .set(authHeader(adminToken))
        .send({
          teacherId: teacher.teacherId,
          primaryStudentId: studentRes.body.id,
          date: lessonDate,
          startTime: '12:00',
          duration: 60,
        })
        .expect(201);

      await api(app)
        .patch(`/api/lessons/${lessonRes.body.id}/cancel`)
        .set(authHeader(adminToken))
        .expect(200);

      const lessonCheck = await api(app)
        .get(`/api/lessons/${lessonRes.body.id}`)
        .set(authHeader(adminToken))
        .expect(200);
      expect(lessonCheck.body.status).toBe('cancelled');

      const bookingsRes = await api(app)
        .post('/api/schedule/bookings/filter')
        .set(authHeader(adminToken))
        .send({ where: { lesson_id: lessonRes.body.id } })
        .expect(201);
      expect(bookingsRes.body[0]?.status).toBe('cancelled');

      const attendanceRes = await api(app)
        .post('/api/lessons/attendance/filter')
        .set(authHeader(adminToken))
        .send({ where: { lesson_id: lessonRes.body.id } })
        .expect(201);
      expect(attendanceRes.body[0]?.attendance_status).toBe('cancelled');
    });
  });
});
