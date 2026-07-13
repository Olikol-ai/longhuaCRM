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

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

describeE2E('Student deletion (e2e)', () => {
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

  it('deletes a student without dependencies', async () => {
    const suffix = randomUUID().slice(0, 8);
    const createRes = await api(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ name: `Deletable Student ${suffix}`, status: 'active' })
      .expect(201);

    const studentId = createRes.body.id as string;

    await api(app)
      .delete(`/api/students/${studentId}`)
      .set(authHeader(adminToken))
      .expect(200);

    await api(app)
      .get(`/api/students/${studentId}`)
      .set(authHeader(adminToken))
      .expect(404);
  });

  it('force-deletes student while preserving payments, lessons, attendance, and certificates', async () => {
    const suffix = randomUUID().slice(0, 8);
    const lessonDate = futureLessonDate(21);

    const teacherRes = await api(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ name: `Student Del Teacher ${suffix}`, status: 'active', hourlyRate: 25 })
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
    const studentId = studentRes.body.id as string;

    const groupRes = await api(app)
      .post('/api/groups')
      .set(authHeader(adminToken))
      .send({ name: `Student Del Group ${suffix}`, teacherId })
      .expect(201);

    await api(app)
      .post(`/api/groups/${groupRes.body.id}/members`)
      .set(authHeader(adminToken))
      .send({ studentId })
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
        primaryStudentId: studentId,
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
      .send({ name: `Student Del Course ${suffix}`, courseType: 'basic_beginner' })
      .expect(201);

    const paymentRes = await api(app)
      .post('/api/payments')
      .set(authHeader(adminToken))
      .send({
        studentId,
        amount: 120,
        lessonsAdded: 4,
        status: 'paid',
        provider: 'manual',
        paymentDate: lessonDate,
      })
      .expect(201);
    const paymentId = paymentRes.body.id as string;

    const enrollmentRes = await api(app)
      .post('/api/courses/enrollments')
      .set(authHeader(adminToken))
      .send({
        studentId,
        courseTemplateId: courseRes.body.id,
        status: 'active',
      })
      .expect(201);
    const enrollmentId = enrollmentRes.body.id as string;

    const certificateRes = await api(app)
      .post('/api/certificates')
      .set(authHeader(adminToken))
      .send({
        studentId,
        courseId: courseRes.body.id,
        registrationNumber: `CERT-${suffix}`,
        status: 'draft',
      })
      .expect(201);
    const certificateId = certificateRes.body.id as string;

    const attendanceBefore = await api(app)
      .post('/api/lessons/attendance/filter')
      .set(authHeader(adminToken))
      .send({ where: { lesson_id: lessonId } })
      .expect(201);
    expect(attendanceBefore.body.length).toBeGreaterThan(0);
    const attendanceId = attendanceBefore.body[0].id as string;

    await api(app)
      .delete(`/api/students/${studentId}`)
      .set(authHeader(adminToken))
      .expect(200);

    await api(app)
      .get(`/api/students/${studentId}`)
      .set(authHeader(adminToken))
      .expect(404);

    const lessonCheck = await api(app)
      .get(`/api/lessons/${lessonId}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(lessonCheck.body.status).toBe('completed');
    expect(
      lessonCheck.body.primary_student_id ?? lessonCheck.body.primaryStudentId,
    ).toBeFalsy();

    const paymentCheck = await api(app)
      .get(`/api/payments/${paymentId}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(paymentCheck.body.student_id ?? paymentCheck.body.studentId).toBeFalsy();
    expect(Number(paymentCheck.body.amount)).toBe(120);

    const enrollmentCheck = await api(app)
      .get(`/api/courses/enrollments/${enrollmentId}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(enrollmentCheck.body.student_id ?? enrollmentCheck.body.studentId).toBeFalsy();

    const certificateCheck = await api(app)
      .get(`/api/certificates/${certificateId}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(certificateCheck.body.student_id ?? certificateCheck.body.studentId).toBeFalsy();

    const attendanceCheck = await api(app)
      .get(`/api/lessons/attendance/${attendanceId}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(attendanceCheck.body.student_id ?? attendanceCheck.body.studentId).toBeFalsy();

    const membersAfter = await api(app)
      .get(`/api/groups/${groupRes.body.id}/members`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(membersAfter.body).toEqual([]);
  });
});
