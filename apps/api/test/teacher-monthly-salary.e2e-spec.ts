import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  adminLogin,
  api,
  authHeader,
  createTestApp,
  ensureDatabaseReady,
} from './e2e-helpers';

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

  async function createTeacher(hourlyRate = 30): Promise<string> {
    const res = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({
        name: `Salary Teacher ${randomUUID().slice(0, 8)}`,
        status: 'active',
        hourlyRate,
      })
      .expect(201);
    return res.body.id as string;
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
    const teacherId = await createTeacher(30);
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
    const teacherId = await createTeacher(20);
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
    const teacherId = await createTeacher(25);
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
    const teacherId = await createTeacher(40);
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
});
