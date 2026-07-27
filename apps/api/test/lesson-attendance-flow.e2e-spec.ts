import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import {
  adminLogin,
  api,
  authHeader,
  createTestApp,
  ensureDatabaseReady,
  futureLessonDate,
} from './e2e-helpers';
import { StudentEntity } from '../src/modules/students/entities/student.entity';

describe('Lesson attendance flow (individual vs group)', () => {
  let app: INestApplication;
  let adminToken: string;
  let ds: DataSource;

  beforeAll(async () => {
    await ensureDatabaseReady();
    app = await createTestApp();
    ds = app.get(DataSource);
    const admin = await adminLogin(app);
    adminToken = admin.token;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('individual: completing lesson creates/updates exactly one attendance (present) + deducts once', async () => {
    const suffix = randomUUID().slice(0, 8);

    const student = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `Individual ${suffix}`, status: 'active' })
      .expect(201);

    const studentId = student.body.id as string;

    await api(app)
      .patch(`/api/students/${studentId}`)
      .set(authHeader(adminToken))
      .send({ lessonBalance: 10 })
      .expect(200);

    const teacher = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ name: `Attendance Teacher ${suffix}`, status: 'active', hourlyRate: 30 })
      .expect(201);
    const teacherId = teacher.body.id as string;

    const lessonRes = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId,
        primaryStudentId: studentId,
        lessonType: 'individual',
        date: futureLessonDate(5),
        startTime: '11:00',
        duration: 60,
        status: 'planned',
      })
      .expect(201);
    const lessonId = lessonRes.body.id as string;

    const completeRes = await api(app)
      .patch(`/api/lessons/${lessonId}/complete`)
      .set(authHeader(adminToken));
    expect(completeRes.status).toBe(200);

    const attendance = await api(app)
      .post('/api/lessons/attendance/filter')
      .set(authHeader(adminToken))
      .send({ where: { lesson_id: lessonId } })
      .expect(201);

    const rows = attendance.body as Array<{
      student_id?: string;
      attendance_status?: string;
      student_name?: string | null;
    }>;

    expect(rows).toHaveLength(1);
    expect(rows[0].student_id).toBe(studentId);
    expect(rows[0].attendance_status).toBe('attended');
    expect(rows[0].student_name).toBe(student.body.name);

    const afterStudent = await api(app)
      .get(`/api/students/${studentId}`)
      .set(authHeader(adminToken));
    expect(afterStudent.status).toBe(200);
    expect(afterStudent.body.lesson_balance ?? afterStudent.body.lessonBalance).toBe(9);

    const payments = await api(app)
      .post('/api/teacher-payments/filter')
      .set(authHeader(adminToken))
      .send({ where: { lesson_id: lessonId } });

    expect(payments.status).toBe(201);
    expect(payments.body).toHaveLength(1);
  });

  it('individual: repeating completion returns 409 and does not create new attendance or double-deduct', async () => {
    const suffix = randomUUID().slice(0, 8);

    const student = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `Individual Repeat ${suffix}`, status: 'active' })
      .expect(201);
    const studentId = student.body.id as string;

    await api(app)
      .patch(`/api/students/${studentId}`)
      .set(authHeader(adminToken))
      .send({ lessonBalance: 10 })
      .expect(200);

    const teacher = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ name: `Repeat Teacher ${suffix}`, status: 'active', hourlyRate: 25 })
      .expect(201);
    const teacherId = teacher.body.id as string;

    const lessonRes = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId,
        primaryStudentId: studentId,
        lessonType: 'individual',
        date: futureLessonDate(6),
        startTime: '12:00',
        duration: 60,
        status: 'planned',
      })
      .expect(201);
    const lessonId = lessonRes.body.id as string;

    await api(app)
      .patch(`/api/lessons/${lessonId}/complete`)
      .set(authHeader(adminToken))
      .expect(200);

    const attendanceBefore = await api(app)
      .post('/api/lessons/attendance/filter')
      .set(authHeader(adminToken))
      .send({ where: { lesson_id: lessonId } })
      .expect(201);
    expect((attendanceBefore.body as Array<unknown>)).toHaveLength(1);

    const paymentsBefore = await api(app)
      .post('/api/teacher-payments/filter')
      .set(authHeader(adminToken))
      .send({ where: { lesson_id: lessonId } });
    expect(paymentsBefore.status).toBe(201);
    expect(paymentsBefore.body).toHaveLength(1);

    const studentBefore = await api(app)
      .get(`/api/students/${studentId}`)
      .set(authHeader(adminToken));
    expect(studentBefore.body.lesson_balance ?? studentBefore.body.lessonBalance).toBe(9);

    const repeat = await api(app)
      .patch(`/api/lessons/${lessonId}/complete`)
      .set(authHeader(adminToken))
      .expect(409);
    expect(repeat.body?.message ?? repeat.body).toBeTruthy();

    const attendanceAfter = await api(app)
      .post('/api/lessons/attendance/filter')
      .set(authHeader(adminToken))
      .send({ where: { lesson_id: lessonId } })
      .expect(201);
    expect((attendanceAfter.body as Array<unknown>)).toHaveLength(1);

    const paymentsAfter = await api(app)
      .post('/api/teacher-payments/filter')
      .set(authHeader(adminToken))
      .send({ where: { lesson_id: lessonId } });
    expect(paymentsAfter.status).toBe(201);
    expect(paymentsAfter.body).toHaveLength(1);

    const studentAfter = await api(app)
      .get(`/api/students/${studentId}`)
      .set(authHeader(adminToken));
    expect(studentAfter.body.lesson_balance ?? studentAfter.body.lessonBalance).toBe(9);
  });

  it('group: completing lesson creates exactly one attendance record per group member', async () => {
    const suffix = randomUUID().slice(0, 8);

    const studentA = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `GroupA ${suffix}`, status: 'active' })
      .expect(201);
    const studentB = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `GroupB ${suffix}`, status: 'active' })
      .expect(201);

    const studentAId = studentA.body.id as string;
    const studentBId = studentB.body.id as string;

    await api(app)
      .patch(`/api/students/${studentAId}`)
      .set(authHeader(adminToken))
      .send({ lessonBalance: 10 })
      .expect(200);
    await api(app)
      .patch(`/api/students/${studentBId}`)
      .set(authHeader(adminToken))
      .send({ lessonBalance: 10 })
      .expect(200);

    const teacher = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ name: `Group Attendance Teacher ${suffix}`, status: 'active', hourlyRate: 40 })
      .expect(201);
    const teacherId = teacher.body.id as string;

    const groupRes = await api(app)
      .post('/api/groups')
      .set(authHeader(adminToken))
      .send({ name: `Group ${suffix}`, teacherId, status: 'active' })
      .expect(201);
    const groupId = groupRes.body.id as string;

    await api(app)
      .post(`/api/groups/${groupId}/members`)
      .set(authHeader(adminToken))
      .send({ studentId: studentAId })
      .expect(201);
    await api(app)
      .post(`/api/groups/${groupId}/members`)
      .set(authHeader(adminToken))
      .send({ studentId: studentBId })
      .expect(201);

    const lessonRes = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId,
        groupId,
        lessonType: 'group',
        date: futureLessonDate(7),
        startTime: '15:00',
        duration: 60,
        status: 'planned',
      })
      .expect(201);
    const lessonId = lessonRes.body.id as string;

    await api(app)
      .patch(`/api/lessons/${lessonId}/complete`)
      .set(authHeader(adminToken))
      .expect(200);

    const attendance = await api(app)
      .post('/api/lessons/attendance/filter')
      .set(authHeader(adminToken))
      .send({ where: { lesson_id: lessonId } })
      .expect(201);

    const rows = attendance.body as Array<{ student_id?: string; attendance_status?: string }>;
    const ids = rows.map((r) => r.student_id);
    expect(rows).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(ids.sort()).toEqual([studentAId, studentBId].sort());
  });

  it('attendance UI name uses Student.name even if first_name/last_name are stale', async () => {
    const suffix = randomUUID().slice(0, 8);
    const correctName = `Бабаева Наталья ${suffix}`;
    const wrongSurname = `Баабева`;

    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: correctName, status: 'active' })
      .expect(201);
    const studentId = studentRes.body.id as string;

    // Simulate legacy desync: name was corrected in admin UI, but first/last are stale.
    await ds.getRepository(StudentEntity).update(studentId, {
      firstName: `Наталья ${suffix}`,
      lastName: wrongSurname,
    });

    await api(app)
      .patch(`/api/students/${studentId}`)
      .set(authHeader(adminToken))
      .send({ lessonBalance: 10 })
      .expect(200);

    const teacher = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ name: `Name-only Teacher ${suffix}`, status: 'active', hourlyRate: 20 })
      .expect(201);
    const teacherId = teacher.body.id as string;

    const lessonRes = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId,
        primaryStudentId: studentId,
        lessonType: 'individual',
        date: futureLessonDate(8),
        startTime: '13:00',
        duration: 60,
        status: 'planned',
      })
      .expect(201);
    const lessonId = lessonRes.body.id as string;

    await api(app)
      .patch(`/api/lessons/${lessonId}/complete`)
      .set(authHeader(adminToken))
      .expect(200);

    const attendance = await api(app)
      .post('/api/lessons/attendance/filter')
      .set(authHeader(adminToken))
      .send({ where: { lesson_id: lessonId } })
      .expect(201);

    const rows = attendance.body as Array<{ student_name?: string | null; student_id?: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].student_id).toBe(studentId);

    const shown = rows[0].student_name ?? '';
    expect(shown).toContain('Бабаева');
    expect(shown).not.toMatch(new RegExp(wrongSurname, 'i'));
    expect(shown).toBe(correctName);
  });
});

