import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  adminLogin,
  api,
  authHeader,
  createTeacherUser,
  createTestApp,
  ensureDatabaseReady,
} from './e2e-helpers';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function nextSaturday(minDays = 14): string {
  const date = new Date();
  date.setDate(date.getDate() + minDays);
  while (date.getDay() !== 6) {
    date.setDate(date.getDate() + 1);
  }
  return formatLocalDate(date);
}

describeE2E('Lesson series generation (e2e)', () => {
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

  it('creates lessons when startDate is a weekend by skipping to next valid slot', async () => {
    const teacher = await createTeacherUser(app, adminToken, {
      email: `series-teacher-${randomUUID().slice(0, 8)}@test.local`,
      password: 'TeacherPass123!',
      name: 'Series Teacher',
    });
    const course = await api(app)
      .post('/api/courses')
      .set(authHeader(adminToken))
      .send({ name: `Series Course ${randomUUID().slice(0, 8)}`, courseType: 'basic_beginner' })
      .expect(201);
    const student = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `Series Student ${randomUUID().slice(0, 8)}`, status: 'active' })
      .expect(201);
    const group = await api(app)
      .post('/api/groups')
      .set(authHeader(adminToken))
      .send({ name: `Series Group ${randomUUID().slice(0, 8)}`, teacherId: teacher.teacherId })
      .expect(201);
    await api(app)
      .post(`/api/groups/${group.body.id}/members`)
      .set(authHeader(adminToken))
      .send({ studentId: student.body.id })
      .expect(201);

    const startDate = nextSaturday();

    for (let day = 0; day <= 6; day += 1) {
      await api(app)
        .post('/api/schedule')
        .set(authHeader(adminToken))
        .send({
          teacherId: teacher.teacherId,
          dayOfWeek: day,
          timeFrom: '09:00',
          timeTo: '18:00',
        })
        .expect(201);
    }

    const seriesRes = await api(app)
      .post('/api/lesson-series')
      .set(authHeader(adminToken))
      .send({
        courseId: course.body.id,
        groupId: group.body.id,
        teacherId: teacher.teacherId,
        startDate,
        startTime: '10:00',
        totalLessons: 2,
        frequency: 'weekly',
        duration: 60,
      })
      .expect(201);

    const lessonsCreated = seriesRes.body.lessons_created ?? seriesRes.body.lessonsCreated;
    const skipped = seriesRes.body.skipped_dates ?? seriesRes.body.skippedDates ?? [];

    expect(Number(lessonsCreated)).toBeGreaterThan(0);
    expect(Array.isArray(skipped)).toBe(true);
    expect(skipped).toContain(startDate);
  });

  it('creates lessons for multiple weekly slots (e.g. Tue and Thu)', async () => {
    const teacher = await createTeacherUser(app, adminToken, {
      email: `multi-slot-${randomUUID().slice(0, 8)}@test.local`,
      password: 'TeacherPass123!',
      name: 'Multi Slot Teacher',
    });
    const course = await api(app)
      .post('/api/courses')
      .set(authHeader(adminToken))
      .send({ name: `Multi Course ${randomUUID().slice(0, 8)}`, courseType: 'basic_beginner' })
      .expect(201);
    const student = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `Multi Student ${randomUUID().slice(0, 8)}`, status: 'active' })
      .expect(201);
    const group = await api(app)
      .post('/api/groups')
      .set(authHeader(adminToken))
      .send({ name: `Multi Group ${randomUUID().slice(0, 8)}`, teacherId: teacher.teacherId })
      .expect(201);
    await api(app)
      .post(`/api/groups/${group.body.id}/members`)
      .set(authHeader(adminToken))
      .send({ studentId: student.body.id })
      .expect(201);

    const start = new Date();
    start.setDate(start.getDate() + 7);
    while (start.getDay() === 0 || start.getDay() === 6) {
      start.setDate(start.getDate() + 1);
    }
    const startDate = formatLocalDate(start);

    for (let day = 0; day <= 6; day += 1) {
      await api(app)
        .post('/api/schedule')
        .set(authHeader(adminToken))
        .send({
          teacherId: teacher.teacherId,
          dayOfWeek: day,
          timeFrom: '09:00',
          timeTo: '21:00',
        })
        .expect(201);
    }

    const seriesRes = await api(app)
      .post('/api/lesson-series')
      .set(authHeader(adminToken))
      .send({
        courseId: course.body.id,
        groupId: group.body.id,
        teacherId: teacher.teacherId,
        startDate,
        totalLessons: 4,
        duration: 60,
        slots: [
          { dayOfWeek: 1, startTime: '18:30' },
          { dayOfWeek: 3, startTime: '18:30' },
        ],
      })
      .expect(201);

    const lessonsCreated = seriesRes.body.lessons_created ?? seriesRes.body.lessonsCreated;
    expect(Number(lessonsCreated)).toBeGreaterThanOrEqual(2);

    const seriesId = (seriesRes.body.series?.id ?? seriesRes.body.id) as string;
    const detail = await api(app)
      .get(`/api/lesson-series/${seriesId}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect((detail.body.slots ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
