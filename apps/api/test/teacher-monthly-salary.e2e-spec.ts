import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import {
  adminLogin,
  api,
  authHeader,
  createTeacherUser,
  createTestApp,
  ensureDatabaseReady,
} from './e2e-helpers';
import { TeacherPaymentEntity } from '../src/modules/teacher-payments/entities/teacher-payment.entity';

describe('Teacher monthly salary summary (e2e)', () => {
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

  async function createStudent(): Promise<string> {
    const res = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `Salary Student ${randomUUID().slice(0, 8)}`, status: 'active' })
      .expect(201);
    return res.body.id as string;
  }

  async function createTeacher(
    hourlyRate = 30,
  ): Promise<{ teacherId: string; token: string }> {
    const suffix = randomUUID().slice(0, 8);
    const teacher = await createTeacherUser(app, adminToken, {
      email: `monthly-salary-${suffix}@test.local`,
      password: 'TestTeacher123!',
      name: `Salary Teacher ${suffix}`,
    });
    await api(app)
      .patch(`/api/teachers/${teacher.teacherId}`)
      .set(authHeader(adminToken))
      .send({ hourlyRate })
      .expect(200);
    return { teacherId: teacher.teacherId, token: teacher.token };
  }

  async function createAndCompleteLesson(params: {
    teacherId: string;
    studentId: string;
    date: string;
    startTime: string;
    duration?: number;
  }): Promise<string> {
    const lesson = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId: params.teacherId,
        primaryStudentId: params.studentId,
        lessonType: 'individual',
        date: params.date,
        startTime: params.startTime,
        duration: params.duration ?? 60,
        status: 'planned',
      })
      .expect(201);

    await api(app)
      .patch(`/api/lessons/${lesson.body.id}/complete`)
      .set(authHeader(adminToken))
      .expect(200);

    return lesson.body.id as string;
  }

  it('aggregates 10 completed July lessons into lessonsCount=10', async () => {
    const { teacherId } = await createTeacher(30);
    const studentId = await createStudent();

    for (let day = 1; day <= 10; day += 1) {
      await createAndCompleteLesson({
        teacherId,
        studentId,
        date: `2026-07-${String(day).padStart(2, '0')}`,
        startTime: '10:00',
        duration: 60,
      });
    }

    const summary = await api(app)
      .get('/api/teacher-payments/summary')
      .query({ month: '2026-07' })
      .set(authHeader(adminToken))
      .expect(200);

    const row = (summary.body as Array<Record<string, unknown>>).find(
      (item) =>
        (item.teacher_id as string) === teacherId ||
        (item.teacherId as string) === teacherId,
    );
    expect(row).toBeTruthy();
    expect(row?.lessons_count ?? row?.lessonsCount).toBe(10);
    expect(Number(row?.total_hours ?? row?.totalHours)).toBe(10);
    expect(Number(row?.amount)).toBe(300);
    expect(row?.payment_status ?? row?.paymentStatus).toBe('unpaid');
  });

  it('counts different months separately', async () => {
    const { teacherId } = await createTeacher(20);
    const studentId = await createStudent();

    await createAndCompleteLesson({
      teacherId,
      studentId,
      date: '2026-06-10',
      startTime: '11:00',
    });
    await createAndCompleteLesson({
      teacherId,
      studentId,
      date: '2026-06-12',
      startTime: '11:00',
    });
    await createAndCompleteLesson({
      teacherId,
      studentId,
      date: '2026-07-15',
      startTime: '11:00',
    });

    const june = await api(app)
      .get('/api/teacher-payments/summary')
      .query({ month: '2026-06' })
      .set(authHeader(adminToken))
      .expect(200);
    const july = await api(app)
      .get('/api/teacher-payments/summary')
      .query({ month: '2026-07' })
      .set(authHeader(adminToken))
      .expect(200);

    const juneRow = (june.body as Array<Record<string, unknown>>).find(
      (item) =>
        (item.teacher_id as string) === teacherId ||
        (item.teacherId as string) === teacherId,
    );
    const julyRow = (july.body as Array<Record<string, unknown>>).find(
      (item) =>
        (item.teacher_id as string) === teacherId ||
        (item.teacherId as string) === teacherId,
    );

    expect(juneRow?.lessons_count ?? juneRow?.lessonsCount).toBe(2);
    expect(julyRow?.lessons_count ?? julyRow?.lessonsCount).toBe(1);
  });

  it('repeated summary requests do not create duplicate payouts', async () => {
    const { teacherId } = await createTeacher(25);
    const studentId = await createStudent();

    await createAndCompleteLesson({
      teacherId,
      studentId,
      date: '2026-05-03',
      startTime: '09:00',
    });

    const first = await api(app)
      .get('/api/teacher-payments/summary')
      .query({ month: '2026-05' })
      .set(authHeader(adminToken))
      .expect(200);
    const second = await api(app)
      .get('/api/teacher-payments/summary')
      .query({ month: '2026-05' })
      .set(authHeader(adminToken))
      .expect(200);

    const firstMatches = (first.body as Array<Record<string, unknown>>).filter(
      (item) =>
        (item.teacher_id as string) === teacherId ||
        (item.teacherId as string) === teacherId,
    );
    const secondMatches = (second.body as Array<Record<string, unknown>>).filter(
      (item) =>
        (item.teacher_id as string) === teacherId ||
        (item.teacherId as string) === teacherId,
    );

    expect(firstMatches).toHaveLength(1);
    expect(secondMatches).toHaveLength(1);
    expect(firstMatches[0]?.payment_status ?? firstMatches[0]?.paymentStatus).toBe(
      'unpaid',
    );
    expect(secondMatches[0]?.payout_id ?? secondMatches[0]?.payoutId ?? null).toBeNull();
  });

  it('marks month as paid and forbids duplicate payout', async () => {
    const { teacherId } = await createTeacher(40);
    const studentId = await createStudent();

    await createAndCompleteLesson({
      teacherId,
      studentId,
      date: '2026-04-08',
      startTime: '14:00',
      duration: 90,
    });

    const pay = await api(app)
      .post('/api/teacher-payments/summary/pay')
      .set(authHeader(adminToken))
      .send({ teacherId, month: '2026-04' })
      .expect(201);

    expect(pay.body.status).toBe('paid');
    expect(pay.body.month).toBe('2026-04');
    expect(Number(pay.body.amount)).toBe(60);

    const summary = await api(app)
      .get('/api/teacher-payments/summary')
      .query({ month: '2026-04' })
      .set(authHeader(adminToken))
      .expect(200);

    const row = (summary.body as Array<Record<string, unknown>>).find(
      (item) =>
        (item.teacher_id as string) === teacherId ||
        (item.teacherId as string) === teacherId,
    );
    expect(row?.payment_status ?? row?.paymentStatus).toBe('paid');

    await api(app)
      .post('/api/teacher-payments/summary/pay')
      .set(authHeader(adminToken))
      .send({ teacherId, month: '2026-04' })
      .expect(409);
  });

  it('admin summary and teacher my/periods match after rate was set post zero-accrual lessons', async () => {
    // Reproduce 210 vs 190 class of bug:
    // lessons completed while hourly_rate=0 leave amount=0 (or no row);
    // admin summary falls back to current rate; teacher cabinet must use same path.
    const suffix = randomUUID().slice(0, 8);
    const teacher = await createTeacherUser(app, adminToken, {
      email: `parity-salary-${suffix}@test.local`,
      password: 'TestTeacher123!',
      name: `Parity Teacher ${suffix}`,
    });
    await api(app)
      .patch(`/api/teachers/${teacher.teacherId}`)
      .set(authHeader(adminToken))
      .send({ hourlyRate: 0 })
      .expect(200);

    const studentId = await createStudent();

    await createAndCompleteLesson({
      teacherId: teacher.teacherId,
      studentId,
      date: '2026-09-09',
      startTime: '10:00',
      duration: 60,
    });
    await createAndCompleteLesson({
      teacherId: teacher.teacherId,
      studentId,
      date: '2026-09-12',
      startTime: '10:00',
      duration: 30,
    });
    const zeroLesson = await createAndCompleteLesson({
      teacherId: teacher.teacherId,
      studentId,
      date: '2026-09-14',
      startTime: '10:00',
      duration: 60,
    });

    // Seed legacy zero snapshot (the bug: stored amount=0 blocks teacher-side sums).
    const paymentRepo = app.get(DataSource).getRepository(TeacherPaymentEntity);
    const existingZero = await paymentRepo.findOne({ where: { lessonId: zeroLesson } });
    if (existingZero) {
      existingZero.amount = 0;
      await paymentRepo.save(existingZero);
    } else {
      await paymentRepo.save(
        paymentRepo.create({
          teacherId: teacher.teacherId,
          lessonId: zeroLesson,
          amount: 0,
          status: 'pending',
          paidAt: null,
        }),
      );
    }

    await api(app)
      .patch(`/api/teachers/${teacher.teacherId}`)
      .set(authHeader(adminToken))
      .send({ hourlyRate: 20 })
      .expect(200);

    await createAndCompleteLesson({
      teacherId: teacher.teacherId,
      studentId,
      date: '2026-09-30',
      startTime: '10:00',
      duration: 60,
    });

    const adminSummary = await api(app)
      .get('/api/teacher-payments/summary')
      .query({ month: '2026-09' })
      .set(authHeader(adminToken))
      .expect(200);

    const adminRow = (adminSummary.body as Array<Record<string, unknown>>).find(
      (item) =>
        (item.teacher_id as string) === teacher.teacherId ||
        (item.teacherId as string) === teacher.teacherId,
    );
    expect(adminRow).toBeTruthy();
    const adminAmount = Number(adminRow?.amount);
    // 60→20 + 30→10 + 60→20 (zero accrual fallback) + 60→20 = 70
    expect(adminAmount).toBe(70);

    const teacherPeriods = await api(app)
      .get('/api/teacher-payments/my/periods')
      .set(authHeader(teacher.token))
      .expect(200);

    const teacherSep = (teacherPeriods.body as Array<Record<string, unknown>>).find(
      (item) => (item.month as string) === '2026-09' || (item.key as string) === '2026-09',
    );
    expect(teacherSep).toBeTruthy();
    expect(Number(teacherSep?.amount)).toBe(adminAmount);
    expect(Number(teacherSep?.payment_count ?? teacherSep?.paymentCount)).toBe(4);

    const adminDetails = await api(app)
      .get('/api/teacher-payments/summary/details')
      .query({ month: '2026-09', teacherId: teacher.teacherId })
      .set(authHeader(adminToken))
      .expect(200);

    const detailAmounts = (adminDetails.body as Array<Record<string, unknown>>).map(
      (row) => Number(row.amount),
    );
    expect(detailAmounts).toEqual([20, 10, 20, 20]);
  });
});
