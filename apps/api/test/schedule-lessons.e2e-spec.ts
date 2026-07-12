import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  adminLogin,
  api,
  authHeader,
  createTeacherUser,
  createTestApp,
  dayOfWeekForDate,
  ensureDatabaseReady,
  futureLessonDate,
} from './e2e-helpers';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

describeE2E('Schedule/Lessons consistency (e2e)', () => {
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

  it('rejects lesson update that overlaps another lesson', async () => {
    const teacher = await createTeacherUser(app, adminToken, {
      email: `schedule-lesson-${randomUUID()}@test.local`,
      password: 'TestTeacher123!',
      name: 'Schedule Lesson Teacher',
    });

    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `Schedule Student ${randomUUID().slice(0, 8)}` })
      .expect(201);

    const lessonDate = futureLessonDate(14);
    await api(app)
      .post('/api/schedule')
      .set(authHeader(adminToken))
      .send({
        teacherId: teacher.teacherId,
        dayOfWeek: dayOfWeekForDate(lessonDate),
        timeFrom: '09:00',
        timeTo: '18:00',
      })
      .expect(201);

    const firstLesson = await api(app)
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

    const secondLesson = await api(app)
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

    const conflictRes = await api(app)
      .patch(`/api/lessons/${secondLesson.body.id}`)
      .set(authHeader(adminToken))
      .send({ startTime: '10:30' });

    expect(conflictRes.status).toBe(400);

    const okRes = await api(app)
      .patch(`/api/lessons/${secondLesson.body.id}`)
      .set(authHeader(adminToken))
      .send({ startTime: '13:00' })
      .expect(200);

    expect(okRes.body.start_time).toBe('13:00:00');

    const bookingsRes = await api(app)
      .post('/api/schedule/bookings/filter')
      .set(authHeader(adminToken))
      .send({ where: { lesson_id: firstLesson.body.id } })
      .expect(201);

    expect(bookingsRes.body[0]?.time_from).toBe('10:00:00');
  });

  it('scopes schedule access to the authenticated teacher', async () => {
    const teacherA = await createTeacherUser(app, adminToken, {
      email: `schedule-scope-a-${randomUUID()}@test.local`,
      password: 'TestTeacher123!',
      name: 'Scope Teacher A',
    });
    const teacherB = await createTeacherUser(app, adminToken, {
      email: `schedule-scope-b-${randomUUID()}@test.local`,
      password: 'TestTeacher123!',
      name: 'Scope Teacher B',
    });

    const lessonDate = futureLessonDate(16);
    await api(app)
      .post('/api/schedule')
      .set(authHeader(adminToken))
      .send({
        teacherId: teacherB.teacherId,
        dayOfWeek: dayOfWeekForDate(lessonDate),
        timeFrom: '09:00',
        timeTo: '18:00',
      })
      .expect(201);

    const forbiddenCheck = await api(app)
      .post(`/api/schedule/teachers/${teacherB.teacherId}/check-availability`)
      .set(authHeader(teacherA.token))
      .send({ date: lessonDate, startTime: '10:00', duration: 60 });

    expect(forbiddenCheck.status).toBe(403);

    const ownCheck = await api(app)
      .post(`/api/schedule/teachers/${teacherA.teacherId}/check-availability`)
      .set(authHeader(teacherA.token))
      .send({ date: lessonDate, startTime: '10:00', duration: 60 })
      .expect(201);

    expect(ownCheck.body.available).toBe(true);
  });
});
