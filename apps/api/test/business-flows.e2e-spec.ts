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
  setPendingVerificationCode,
} from './e2e-helpers';
import { DataSource } from 'typeorm';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { StudentEntity } from '../src/modules/students/entities/student.entity';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

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

      expect(verifyRes.body.token).toBeTruthy();

      const loginRes = await api(app).post('/api/auth/login').send({ email, password }).expect(201);
      expect(loginRes.body.token).toBeTruthy();
      expect(loginRes.body.user?.email).toBe(email);
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
          blankNumber: '00042',
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
