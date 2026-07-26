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

  it('creates individual lesson from legacy studentId alias and rejects missing target', async () => {
    const teacher = await createTeacherUser(app, adminToken, {
      email: `lesson-target-${randomUUID()}@test.local`,
      password: 'TestTeacher123!',
      name: 'Lesson Target Teacher',
    });

    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `Lesson Target Student ${randomUUID().slice(0, 8)}` })
      .expect(201);

    const lessonDate = futureLessonDate(21);
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

    const missingTarget = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId: teacher.teacherId,
        date: lessonDate,
        startTime: '09:00',
        duration: 60,
      });

    expect(missingTarget.status).toBe(400);
    const missingMessage = Array.isArray(missingTarget.body.message)
      ? missingTarget.body.message.join(' ')
      : String(missingTarget.body.message ?? '');
    expect(missingMessage).toMatch(/ученика|группу/i);

    const created = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId: teacher.teacherId,
        studentId: studentRes.body.id,
        date: lessonDate,
        startTime: '10:00',
        duration: 60,
      })
      .expect(201);

    expect(created.body.primary_student_id).toBe(studentRes.body.id);
    expect(created.body.student_id).toBe(studentRes.body.id);
    expect(created.body.lesson_type).toBe('individual');
    expect(created.body.teacher_id).toBe(teacher.teacherId);

    const groupRes = await api(app)
      .post('/api/groups')
      .set(authHeader(adminToken))
      .send({
        name: `Lesson Group ${randomUUID().slice(0, 8)}`,
        teacherId: teacher.teacherId,
      })
      .expect(201);

    await api(app)
      .post(`/api/groups/${groupRes.body.id}/members`)
      .set(authHeader(adminToken))
      .send({ studentId: studentRes.body.id })
      .expect(201);

    const groupLesson = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId: teacher.teacherId,
        groupId: groupRes.body.id,
        date: lessonDate,
        startTime: '14:00',
        duration: 60,
        lessonType: 'group',
      })
      .expect(201);

    expect(groupLesson.body.group_id).toBe(groupRes.body.id);
    expect(groupLesson.body.lesson_type).toBe('group');
    expect(groupLesson.body.primary_student_id ?? null).toBeNull();

    const attendance = await api(app)
      .post('/api/lessons/attendance/filter')
      .set(authHeader(adminToken))
      .send({ where: { lesson_id: groupLesson.body.id } })
      .expect(201);

    expect(attendance.body.some((row: { student_id?: string }) => row.student_id === studentRes.body.id)).toBe(
      true,
    );
  });

  it('allows a teacher to create a lesson for themselves', async () => {
    const teacher = await createTeacherUser(app, adminToken, {
      email: `lesson-teacher-create-${randomUUID()}@test.local`,
      password: 'TestTeacher123!',
      name: 'Teacher Create Lesson',
    });

    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({
        name: `Teacher Create Student ${randomUUID().slice(0, 8)}`,
        assignedTeacherId: teacher.teacherId,
      })
      .expect(201);

    const lessonDate = futureLessonDate(22);
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

    const created = await api(app)
      .post('/api/lessons')
      .set(authHeader(teacher.token))
      .send({
        teacherId: teacher.teacherId,
        primaryStudentId: studentRes.body.id,
        date: lessonDate,
        startTime: '11:00',
        duration: 60,
      })
      .expect(201);

    expect(created.body.teacher_id).toBe(teacher.teacherId);
    expect(created.body.primary_student_id).toBe(studentRes.body.id);
  });

  it('allows create and reschedule into a slot freed by PATCH status=cancelled', async () => {
    const teacher = await createTeacherUser(app, adminToken, {
      email: `schedule-cancel-slot-${randomUUID()}@test.local`,
      password: 'TestTeacher123!',
      name: 'Cancel Slot Teacher',
    });

    const studentA = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `Cancel Slot A ${randomUUID().slice(0, 8)}` })
      .expect(201);

    const studentB = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `Cancel Slot B ${randomUUID().slice(0, 8)}` })
      .expect(201);

    const lessonDate = futureLessonDate(23);
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

    const cancelledLesson = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId: teacher.teacherId,
        primaryStudentId: studentA.body.id,
        date: lessonDate,
        startTime: '12:00',
        duration: 60,
      })
      .expect(201);

    const otherLesson = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId: teacher.teacherId,
        primaryStudentId: studentB.body.id,
        date: lessonDate,
        startTime: '14:00',
        duration: 60,
      })
      .expect(201);

    await api(app)
      .patch(`/api/lessons/${cancelledLesson.body.id}`)
      .set(authHeader(adminToken))
      .send({ status: 'cancelled' })
      .expect(200);

    const bookingsRes = await api(app)
      .post('/api/schedule/bookings/filter')
      .set(authHeader(adminToken))
      .send({ where: { lesson_id: cancelledLesson.body.id } })
      .expect(201);
    expect(bookingsRes.body[0]?.status).toBe('cancelled');

    const recreated = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId: teacher.teacherId,
        primaryStudentId: studentA.body.id,
        date: lessonDate,
        startTime: '12:00',
        duration: 60,
      })
      .expect(201);
    expect(recreated.body.start_time).toBe('12:00:00');

    await api(app)
      .patch(`/api/lessons/${recreated.body.id}`)
      .set(authHeader(adminToken))
      .send({ status: 'cancelled' })
      .expect(200);

    const moved = await api(app)
      .patch(`/api/lessons/${otherLesson.body.id}`)
      .set(authHeader(adminToken))
      .send({ startTime: '12:00' })
      .expect(200);
    expect(moved.body.start_time).toBe('12:00:00');

    const stillBlocked = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId: teacher.teacherId,
        primaryStudentId: studentA.body.id,
        date: lessonDate,
        startTime: '12:00',
        duration: 60,
      });
    expect(stillBlocked.status).toBe(400);
  });
});
