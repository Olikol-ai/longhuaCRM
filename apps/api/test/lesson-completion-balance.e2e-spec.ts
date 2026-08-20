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

describe('Lesson completion balance & attendance (e2e)', () => {
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

  it('individual: balance 10→9, single TeacherPayment, repeat complete is 409', async () => {
    const suffix = randomUUID().slice(0, 8);

    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `Balance ${suffix}`, status: 'active' });
    expect(studentRes.status).toBe(201);
    const studentId = studentRes.body.id as string;

    await api(app)
      .patch(`/api/students/${studentId}`)
      .set(authHeader(adminToken))
      .send({ lessonBalance: 10 });

    const teacherRes = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ name: `Pay Teacher ${suffix}`, status: 'active', hourlyRate: 30 });
    const teacherId = teacherRes.body.id as string;

    const lessonRes = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId,
        primaryStudentId: studentId,
        date: futureLessonDate(4),
        startTime: '11:00',
        duration: 60,
        status: 'planned',
      });
    expect(lessonRes.status).toBe(201);
    const lessonId = lessonRes.body.id as string;

    const first = await api(app)
      .patch(`/api/lessons/${lessonId}/complete`)
      .set(authHeader(adminToken));
    expect(first.status).toBe(200);
    expect(first.body.status).toBe('completed');

    const afterFirst = await api(app)
      .get(`/api/students/${studentId}`)
      .set(authHeader(adminToken));
    expect(afterFirst.body.lesson_balance ?? afterFirst.body.lessonBalance).toBe(9);

    const second = await api(app)
      .patch(`/api/lessons/${lessonId}/complete`)
      .set(authHeader(adminToken));
    expect(second.status).toBe(409);

    const afterSecond = await api(app)
      .get(`/api/students/${studentId}`)
      .set(authHeader(adminToken));
    expect(afterSecond.body.lesson_balance ?? afterSecond.body.lessonBalance).toBe(9);

    const payments = await api(app)
      .post('/api/teacher-payments/filter')
      .set(authHeader(adminToken))
      .send({ where: { lesson_id: lessonId } });
    expect(payments.status).toBe(201);
    expect(payments.body).toHaveLength(1);
  });

  it('group: deducts each member once and creates one TeacherPayment', async () => {
    const suffix = randomUUID().slice(0, 8);

    const studentA = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `GroupA ${suffix}`, status: 'active' });
    const studentB = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `GroupB ${suffix}`, status: 'active' });
    const studentAId = studentA.body.id as string;
    const studentBId = studentB.body.id as string;

    await api(app)
      .patch(`/api/students/${studentAId}`)
      .set(authHeader(adminToken))
      .send({ lessonBalance: 10 });
    await api(app)
      .patch(`/api/students/${studentBId}`)
      .set(authHeader(adminToken))
      .send({ lessonBalance: 10 });

    const teacherRes = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ name: `Group Teacher ${suffix}`, status: 'active', hourlyRate: 40 });
    const teacherId = teacherRes.body.id as string;

    const groupRes = await api(app)
      .post('/api/groups')
      .set(authHeader(adminToken))
      .send({ name: `Group ${suffix}`, teacherId, status: 'active' });
    expect(groupRes.status).toBe(201);
    const groupId = groupRes.body.id as string;

    await api(app)
      .post(`/api/groups/${groupId}/members`)
      .set(authHeader(adminToken))
      .send({ studentId: studentAId });
    await api(app)
      .post(`/api/groups/${groupId}/members`)
      .set(authHeader(adminToken))
      .send({ studentId: studentBId });

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
      });
    expect(lessonRes.status).toBe(201);
    const lessonId = lessonRes.body.id as string;

    const completeRes = await api(app)
      .patch(`/api/lessons/${lessonId}/complete`)
      .set(authHeader(adminToken));
    expect(completeRes.status).toBe(200);

    const afterA = await api(app)
      .get(`/api/students/${studentAId}`)
      .set(authHeader(adminToken));
    const afterB = await api(app)
      .get(`/api/students/${studentBId}`)
      .set(authHeader(adminToken));
    expect(afterA.body.lesson_balance ?? afterA.body.lessonBalance).toBe(9);
    expect(afterB.body.lesson_balance ?? afterB.body.lessonBalance).toBe(9);

    const attendance = await api(app)
      .post('/api/lessons/attendance/filter')
      .set(authHeader(adminToken))
      .send({ where: { lesson_id: lessonId } });
    const studentIds = (attendance.body as Array<{ student_id?: string }>).map(
      (row) => row.student_id,
    );
    expect(studentIds.sort()).toEqual([studentAId, studentBId].sort());

    const payments = await api(app)
      .post('/api/teacher-payments/filter')
      .set(authHeader(adminToken))
      .send({ where: { lesson_id: lessonId } });
    expect(payments.body).toHaveLength(1);

    const repeat = await api(app)
      .patch(`/api/lessons/${lessonId}/complete`)
      .set(authHeader(adminToken));
    expect(repeat.status).toBe(409);
  });

  it('after reassigning primary student, complete deducts the new student only', async () => {
    const suffix = randomUUID().slice(0, 8);

    const studentA = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `Old ${suffix}`, status: 'active' });
    const studentB = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `New ${suffix}`, status: 'active' });
    const studentAId = studentA.body.id as string;
    const studentBId = studentB.body.id as string;

    await api(app)
      .patch(`/api/students/${studentAId}`)
      .set(authHeader(adminToken))
      .send({ lessonBalance: 5 });
    await api(app)
      .patch(`/api/students/${studentBId}`)
      .set(authHeader(adminToken))
      .send({ lessonBalance: 5 });

    const teacherRes = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ name: `Reassign Teacher ${suffix}`, status: 'active', hourlyRate: 20 });
    const teacherId = teacherRes.body.id as string;

    const lessonRes = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId,
        primaryStudentId: studentAId,
        date: futureLessonDate(5),
        startTime: '12:00',
        duration: 60,
        status: 'planned',
      });
    const lessonId = lessonRes.body.id as string;

    await api(app)
      .patch(`/api/lessons/${lessonId}`)
      .set(authHeader(adminToken))
      .send({ primaryStudentId: studentBId });

    const attendance = await api(app)
      .post('/api/lessons/attendance/filter')
      .set(authHeader(adminToken))
      .send({ where: { lesson_id: lessonId } });
    expect(attendance.body).toHaveLength(1);
    expect(attendance.body[0].student_id).toBe(studentBId);

    await api(app)
      .patch(`/api/lessons/${lessonId}/complete`)
      .set(authHeader(adminToken))
      .expect(200);

    const afterA = await api(app)
      .get(`/api/students/${studentAId}`)
      .set(authHeader(adminToken));
    const afterB = await api(app)
      .get(`/api/students/${studentBId}`)
      .set(authHeader(adminToken));
    expect(afterA.body.lesson_balance ?? afterA.body.lessonBalance).toBe(5);
    expect(afterB.body.lesson_balance ?? afterB.body.lessonBalance).toBe(4);
  });

  it('attendance shows primary student after reassignment + complete', async () => {
    const suffix = randomUUID().slice(0, 8);

    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({
        name: `Можейко Оксана ${suffix}`,
        firstName: 'Оксана',
        lastName: 'Можейко',
        status: 'active',
      });
    const studentId = studentRes.body.id as string;

    await api(app)
      .patch(`/api/students/${studentId}`)
      .set(authHeader(adminToken))
      .send({ lessonBalance: 3 });

    const staleRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `Stale ${suffix}`, status: 'active' });
    const staleId = staleRes.body.id as string;

    const teacherRes = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ name: `Att Teacher ${suffix}`, status: 'active', hourlyRate: 25 });
    const teacherId = teacherRes.body.id as string;

    const lessonRes = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId,
        primaryStudentId: staleId,
        date: futureLessonDate(6),
        startTime: '13:00',
        duration: 60,
        status: 'planned',
      });
    const lessonId = lessonRes.body.id as string;

    await api(app)
      .patch(`/api/lessons/${lessonId}`)
      .set(authHeader(adminToken))
      .send({ primaryStudentId: studentId });

    await api(app)
      .patch(`/api/lessons/${lessonId}/complete`)
      .set(authHeader(adminToken))
      .expect(200);

    const attendance = await api(app)
      .post('/api/lessons/attendance/filter')
      .set(authHeader(adminToken))
      .send({ where: { lesson_id: lessonId } });
    expect(attendance.body).toHaveLength(1);
    expect(attendance.body[0].student_id).toBe(studentId);
    expect(attendance.body[0].attendance_status).toBe('attended');
    const label = String(
      attendance.body[0].student_name ?? attendance.body[0].studentName ?? '',
    );
    expect(label).toContain('Можейко');
    expect(label).toContain('Оксана');
    expect(label.toLowerCase()).not.toContain('универсал');
    expect(label.toLowerCase()).not.toContain('unknown');
    expect(label.toLowerCase()).not.toContain('stale');
  });

  it('allows completing lessons into negative balance (debt) and payment restores arithmetically', async () => {
    const suffix = randomUUID().slice(0, 8);

    const studentRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `Debt ${suffix}`, status: 'active', lessonBalance: 0 });
    expect(studentRes.status).toBe(201);
    const studentId = studentRes.body.id as string;

    const teacherRes = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ name: `Debt Teacher ${suffix}`, status: 'active', hourlyRate: 30 });
    const teacherId = teacherRes.body.id as string;

    const lesson1 = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId,
        primaryStudentId: studentId,
        date: futureLessonDate(7),
        startTime: '10:00',
        duration: 60,
        status: 'planned',
      });
    expect(lesson1.status).toBe(201);

    await api(app)
      .patch(`/api/lessons/${lesson1.body.id}/complete`)
      .set(authHeader(adminToken))
      .expect(200);

    let student = await api(app)
      .get(`/api/students/${studentId}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(student.body.lesson_balance ?? student.body.lessonBalance).toBe(-1);

    const lesson2 = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId,
        primaryStudentId: studentId,
        date: futureLessonDate(8),
        startTime: '11:00',
        duration: 60,
        status: 'planned',
      });
    expect(lesson2.status).toBe(201);

    await api(app)
      .patch(`/api/lessons/${lesson2.body.id}/complete`)
      .set(authHeader(adminToken))
      .expect(200);

    student = await api(app)
      .get(`/api/students/${studentId}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(student.body.lesson_balance ?? student.body.lessonBalance).toBe(-2);

    const payment = await api(app)
      .post('/api/payments')
      .set(authHeader(adminToken))
      .send({
        studentId,
        amount: 8000,
        status: 'paid',
        lessonsAdded: 8,
      });
    expect(payment.status).toBe(201);

    student = await api(app)
      .get(`/api/students/${studentId}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(student.body.lesson_balance ?? student.body.lessonBalance).toBe(6);
  });
});
