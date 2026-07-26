import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  adminLogin,
  api,
  authHeader,
  createTestApp,
  ensureDatabaseReady,
  futureLessonDate,
} from './e2e-helpers';

describe('Lesson completion idempotency (e2e)', () => {
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

  it('deducts lesson balance only once when complete is called twice', async () => {
    const suffix = randomUUID().slice(0, 8);

    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `Idempotent ${suffix}`, status: 'active' });
    expect(studentRes.status).toBe(201);
    const studentId = studentRes.body.id as string;

    await api(app)
      .patch(`/api/students/${studentId}`)
      .set(authHeader(adminToken))
      .send({ lessonBalance: 5 });

    const teacherRes = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ name: `Teacher ${suffix}`, status: 'active', hourlyRate: 20 });
    const teacherId = teacherRes.body.id as string;

    const lessonRes = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId,
        primaryStudentId: studentId,
        date: futureLessonDate(3),
        startTime: '10:00',
        duration: 60,
        status: 'planned',
      });
    expect(lessonRes.status).toBe(201);
    const lessonId = lessonRes.body.id as string;

    const first = await api(app)
      .patch(`/api/lessons/${lessonId}/complete`)
      .set(authHeader(adminToken));
    expect(first.status).toBe(200);

    const second = await api(app)
      .patch(`/api/lessons/${lessonId}/complete`)
      .set(authHeader(adminToken));
    // Already finalized — must not re-run balance / TeacherPayment side effects.
    expect(second.status).toBe(409);

    const studentAfter = await api(app)
      .get(`/api/students/${studentId}`)
      .set(authHeader(adminToken));
    expect(studentAfter.body.lesson_balance ?? studentAfter.body.lessonBalance).toBe(4);
  });
});
