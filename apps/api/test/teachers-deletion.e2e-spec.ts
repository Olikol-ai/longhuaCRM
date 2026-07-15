import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import {
  adminLogin,
  api,
  authHeader,
  createTestApp,
  dayOfWeekForDate,
  ensureDatabaseReady,
  futureLessonDate,
} from './e2e-helpers';
import { UserEntity } from '../src/modules/users/entities/user.entity';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

describeE2E('Teacher deletion (e2e)', () => {
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

  it('deletes a teacher without dependencies and unassigns students', async () => {
    const suffix = randomUUID().slice(0, 8);
    const createRes = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ name: `Deletable Teacher ${suffix}`, status: 'active' })
      .expect(201);

    const teacherId = createRes.body.id as string;

    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({
        name: `Assigned Student ${suffix}`,
        assignedTeacherId: teacherId,
        status: 'active',
      })
      .expect(201);

    const deleteRes = await api(app)
      .delete(`/api/teachers/${teacherId}`)
      .set(authHeader(adminToken))
      .expect(200);

    expect(deleteRes.body.orphan_students).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: studentRes.body.id }),
      ]),
    );

    await api(app)
      .get(`/api/teachers/${teacherId}`)
      .set(authHeader(adminToken))
      .expect(404);

    const studentCheck = await api(app)
      .get(`/api/students/${studentRes.body.id}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(
      studentCheck.body.assigned_teacher
        ?? studentCheck.body.assignedTeacherId
        ?? studentCheck.body.assigned_teacher_id,
    ).toBeFalsy();
  });

  it('removes linked account from users directory after teacher delete', async () => {
    const suffix = randomUUID().slice(0, 8);
    const email = `deleted-teacher-${suffix}@example.com`;
    const userId = randomUUID();
    const now = new Date();
    const ds = app.get(DataSource);

    await ds.getRepository(UserEntity).save({
      id: userId,
      email,
      passwordHash: bcrypt.hashSync('TestPass123!', 10),
      role: 'teacher',
      status: 'active',
      emailVerified: true,
      verificationCode: null,
      verificationCodeExpiresAt: null,
      verificationCodeSentAt: null,
      verificationAttempts: 0,
      firstName: 'Gone',
      lastName: `Teacher${suffix}`,
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

    const teacherRes = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({
        name: `Linked Teacher ${suffix}`,
        email,
        status: 'active',
        userId,
      })
      .expect(201);
    const teacherId = teacherRes.body.id as string;

    const beforeDir = await api(app)
      .get('/api/users/directory')
      .set(authHeader(adminToken))
      .expect(200);
    expect(
      beforeDir.body.find((row: { id: string }) => row.id === userId),
    ).toBeDefined();

    await api(app)
      .delete(`/api/teachers/${teacherId}`)
      .set(authHeader(adminToken))
      .expect(200);

    await api(app)
      .get(`/api/teachers/${teacherId}`)
      .set(authHeader(adminToken))
      .expect(404);

    const afterDir = await api(app)
      .get('/api/users/directory')
      .set(authHeader(adminToken))
      .expect(200);
    expect(
      afterDir.body.find((row: { id: string }) => row.id === userId),
    ).toBeUndefined();
    expect(
      afterDir.body.find(
        (row: { email?: string; teacher_profile_id?: string }) =>
          row.email === email || row.teacher_profile_id === teacherId,
      ),
    ).toBeUndefined();

    const usersList = await api(app)
      .get('/api/users')
      .set(authHeader(adminToken))
      .expect(200);
    expect(
      usersList.body.find((row: { id: string }) => row.id === userId),
    ).toBeUndefined();

    const blockedUser = await ds.getRepository(UserEntity).findOne({ where: { id: userId } });
    expect(blockedUser).toBeTruthy();
    expect(blockedUser?.status).toBe('blocked');
    expect(blockedUser?.role).toBe('');
  });

  it('force-deletes teacher while preserving lessons, groups, series, and payments', async () => {
    const suffix = randomUUID().slice(0, 8);
    const lessonDate = futureLessonDate(21);

    const teacherRes = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ name: `History Teacher ${suffix}`, status: 'active', hourlyRate: 30 })
      .expect(201);
    const teacherId = teacherRes.body.id as string;

    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({
        name: `History Student ${suffix}`,
        assignedTeacherId: teacherId,
        status: 'active',
      })
      .expect(201);

    const groupRes = await api(app)
      .post('/api/groups')
      .set(authHeader(adminToken))
      .send({ name: `History Group ${suffix}`, teacherId })
      .expect(201);

    await api(app)
      .post(`/api/groups/${groupRes.body.id}/members`)
      .set(authHeader(adminToken))
      .send({ studentId: studentRes.body.id })
      .expect(201);

    for (let day = 0; day <= 6; day += 1) {
      await api(app)
        .post('/api/schedule')
        .set(authHeader(adminToken))
        .send({
          teacherId,
          dayOfWeek: day,
          timeFrom: '08:00',
          timeTo: '20:00',
        })
        .expect(201);
    }

    const lessonRes = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId,
        primaryStudentId: studentRes.body.id,
        date: lessonDate,
        startTime: '11:00',
        duration: 60,
      })
      .expect(201);
    const lessonId = lessonRes.body.id as string;

    await api(app)
      .patch(`/api/lessons/${lessonId}`)
      .set(authHeader(adminToken))
      .send({ status: 'completed' })
      .expect(200);

    const courseRes = await api(app)
      .post('/api/courses')
      .set(authHeader(adminToken))
      .send({ name: `Series Course ${suffix}`, courseType: 'basic_beginner' })
      .expect(201);

    const seriesStartDate = futureLessonDate(28);
    const seriesRes = await api(app)
      .post('/api/lesson-series')
      .set(authHeader(adminToken))
      .send({
        courseId: courseRes.body.id,
        groupId: groupRes.body.id,
        teacherId,
        startDate: seriesStartDate,
        startTime: '10:00',
        frequency: 'weekly',
        totalLessons: 2,
        duration: 60,
      })
      .expect(201);
    const seriesId = (seriesRes.body.series?.id ?? seriesRes.body.id) as string;

    const paymentsBefore = await api(app)
      .post('/api/teacher-payments/filter')
      .set(authHeader(adminToken))
      .send({ where: { teacher_id: teacherId } })
      .expect(201);
    expect(paymentsBefore.body.length).toBeGreaterThan(0);
    const paymentId = paymentsBefore.body[0].id as string;

    const slotsBefore = await api(app)
      .post('/api/schedule/filter')
      .set(authHeader(adminToken))
      .send({ where: { teacher_id: teacherId } })
      .expect(201);
    expect(slotsBefore.body.length).toBeGreaterThan(0);

    await api(app)
      .delete(`/api/teachers/${teacherId}`)
      .set(authHeader(adminToken))
      .expect(200);

    await api(app)
      .get(`/api/teachers/${teacherId}`)
      .set(authHeader(adminToken))
      .expect(404);

    const lessonCheck = await api(app)
      .get(`/api/lessons/${lessonId}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(lessonCheck.body.status).toBe('completed');
    expect(lessonCheck.body.teacher_id ?? lessonCheck.body.teacherId).toBeFalsy();

    const attendanceCheck = await api(app)
      .post('/api/lessons/attendance/filter')
      .set(authHeader(adminToken))
      .send({ where: { lesson_id: lessonId } })
      .expect(201);
    expect(attendanceCheck.body.length).toBeGreaterThan(0);

    const groupCheck = await api(app)
      .get(`/api/groups/${groupRes.body.id}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(groupCheck.body.teacher_id ?? groupCheck.body.teacherId).toBeFalsy();

    const seriesCheck = await api(app)
      .get(`/api/lesson-series/${seriesId}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(seriesCheck.body.teacher_id ?? seriesCheck.body.teacherId).toBeFalsy();

    const paymentCheck = await api(app)
      .get(`/api/teacher-payments/${paymentId}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(paymentCheck.body.teacher_id ?? paymentCheck.body.teacherId).toBeFalsy();
    expect(Number(paymentCheck.body.amount)).toBeGreaterThan(0);

    const studentCheck = await api(app)
      .get(`/api/students/${studentRes.body.id}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(
      studentCheck.body.assigned_teacher
        ?? studentCheck.body.assignedTeacherId
        ?? studentCheck.body.assigned_teacher_id,
    ).toBeFalsy();

    const slotsAfter = await api(app)
      .post('/api/schedule/filter')
      .set(authHeader(adminToken))
      .send({ where: { teacher_id: teacherId } })
      .expect(201);
    expect(slotsAfter.body).toEqual([]);

    const bookingsAfter = await api(app)
      .post('/api/schedule/bookings/filter')
      .set(authHeader(adminToken))
      .send({ where: { teacher_id: teacherId } })
      .expect(201);
    expect(bookingsAfter.body).toEqual([]);
  });
});
