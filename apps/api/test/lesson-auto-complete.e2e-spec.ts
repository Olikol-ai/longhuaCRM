import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  adminLogin,
  api,
  authHeader,
  createTestApp,
  ensureDatabaseReady,
} from './e2e-helpers';
import { LessonsScheduler } from '../src/modules/lessons/lessons.scheduler';

/**
 * Wall-clock slot in Europe/Minsk that already ended (start = now - hoursAgo).
 * Matches LessonsScheduler timezone handling.
 */
function pastEndedLessonSlot(
  hoursAgo = 2,
  durationMinutes = 60,
): { date: string; startTime: string; duration: number } {
  const tz = 'Europe/Minsk';
  const now = new Date();
  const localized = new Date(now.toLocaleString('en-US', { timeZone: tz }));
  const start = new Date(localized.getTime() - hoursAgo * 60 * 60 * 1000);
  const year = start.getFullYear();
  const month = String(start.getMonth() + 1).padStart(2, '0');
  const day = String(start.getDate()).padStart(2, '0');
  const hours = String(start.getHours()).padStart(2, '0');
  const minutes = String(start.getMinutes()).padStart(2, '0');
  return {
    date: `${year}-${month}-${day}`,
    startTime: `${hours}:${minutes}`,
    duration: durationMinutes,
  };
}

describe('Lesson auto-complete scheduler (e2e)', () => {
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

  it('processCompletedLessons finalizes expired planned lesson once (balance + payment + attendance)', async () => {
    const suffix = randomUUID().slice(0, 8);
    const slot = pastEndedLessonSlot(2, 60);

    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `AutoComplete ${suffix}`, status: 'active' });
    expect(studentRes.status).toBe(201);
    const studentId = studentRes.body.id as string;

    await api(app)
      .patch(`/api/students/${studentId}`)
      .set(authHeader(adminToken))
      .send({ lessonBalance: 10 });

    const teacherRes = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({
        name: `Auto Teacher ${suffix}`,
        status: 'active',
        hourlyRate: 25,
      });
    expect(teacherRes.status).toBe(201);
    const teacherId = teacherRes.body.id as string;

    const lessonRes = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId,
        primaryStudentId: studentId,
        date: slot.date,
        startTime: slot.startTime,
        duration: slot.duration,
        status: 'planned',
        lessonType: 'individual',
      });
    expect(lessonRes.status).toBe(201);
    const lessonId = lessonRes.body.id as string;
    expect(lessonRes.body.status).toBe('planned');

    const scheduler = app.get(LessonsScheduler);
    const firstRun = await scheduler.processCompletedLessons();
    expect(firstRun.success).toBe(true);
    expect(firstRun.count).toBeGreaterThanOrEqual(1);

    const lessonAfter = await api(app)
      .get(`/api/lessons/${lessonId}`)
      .set(authHeader(adminToken));
    expect(lessonAfter.status).toBe(200);
    expect(lessonAfter.body.status).toBe('completed');

    const studentAfter = await api(app)
      .get(`/api/students/${studentId}`)
      .set(authHeader(adminToken));
    expect(studentAfter.body.lesson_balance ?? studentAfter.body.lessonBalance).toBe(
      9,
    );

    const payments = await api(app)
      .post('/api/teacher-payments/filter')
      .set(authHeader(adminToken))
      .send({ where: { lesson_id: lessonId } });
    expect(payments.status).toBe(201);
    expect(payments.body).toHaveLength(1);

    const attendance = await api(app)
      .post('/api/lessons/attendance/filter')
      .set(authHeader(adminToken))
      .send({ where: { lesson_id: lessonId } });
    expect(attendance.status).toBe(201);
    expect(attendance.body.length).toBeGreaterThanOrEqual(1);
    const studentRow = attendance.body.find(
      (row: { student_id?: string; studentId?: string }) =>
        (row.student_id ?? row.studentId) === studentId,
    );
    expect(studentRow).toBeDefined();
    expect(
      studentRow.attendance_status ?? studentRow.attendanceStatus,
    ).toBe('attended');

    const balanceBeforeSecond = studentAfter.body.lesson_balance ?? studentAfter.body.lessonBalance;

    const secondRun = await scheduler.processCompletedLessons();
    expect(secondRun.success).toBe(true);

    const studentAfterSecond = await api(app)
      .get(`/api/students/${studentId}`)
      .set(authHeader(adminToken));
    expect(
      studentAfterSecond.body.lesson_balance ?? studentAfterSecond.body.lessonBalance,
    ).toBe(balanceBeforeSecond);

    const paymentsAfterSecond = await api(app)
      .post('/api/teacher-payments/filter')
      .set(authHeader(adminToken))
      .send({ where: { lesson_id: lessonId } });
    expect(paymentsAfterSecond.body).toHaveLength(1);
  });

  it('does not auto-complete cancelled or future lessons', async () => {
    const suffix = randomUUID().slice(0, 8);
    const past = pastEndedLessonSlot(3, 60);
    const futureDate = (() => {
      const tz = 'Europe/Minsk';
      const now = new Date();
      const localized = new Date(now.toLocaleString('en-US', { timeZone: tz }));
      localized.setDate(localized.getDate() + 5);
      const year = localized.getFullYear();
      const month = String(localized.getMonth() + 1).padStart(2, '0');
      const day = String(localized.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    })();

    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `Skip Auto ${suffix}`, status: 'active' });
    const studentId = studentRes.body.id as string;
    await api(app)
      .patch(`/api/students/${studentId}`)
      .set(authHeader(adminToken))
      .send({ lessonBalance: 5 });

    const teacherRes = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ name: `Skip Teacher ${suffix}`, status: 'active', hourlyRate: 20 });
    const teacherId = teacherRes.body.id as string;

    const cancelledRes = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId,
        primaryStudentId: studentId,
        date: past.date,
        startTime: past.startTime,
        duration: past.duration,
        status: 'planned',
      });
    const cancelledId = cancelledRes.body.id as string;
    await api(app)
      .patch(`/api/lessons/${cancelledId}`)
      .set(authHeader(adminToken))
      .send({ status: 'cancelled' });

    const futureRes = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId,
        primaryStudentId: studentId,
        date: futureDate,
        startTime: '10:00',
        duration: 60,
        status: 'planned',
      });
    const futureId = futureRes.body.id as string;

    await app.get(LessonsScheduler).processCompletedLessons();

    const cancelledAfter = await api(app)
      .get(`/api/lessons/${cancelledId}`)
      .set(authHeader(adminToken));
    expect(cancelledAfter.body.status).toBe('cancelled');

    const futureAfter = await api(app)
      .get(`/api/lessons/${futureId}`)
      .set(authHeader(adminToken));
    expect(futureAfter.body.status).toBe('planned');

    const studentAfter = await api(app)
      .get(`/api/students/${studentId}`)
      .set(authHeader(adminToken));
    expect(studentAfter.body.lesson_balance ?? studentAfter.body.lessonBalance).toBe(
      5,
    );
  });
});
