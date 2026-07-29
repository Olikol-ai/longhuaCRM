import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import {
  api,
  authHeader,
  createTestApp,
  ensureDatabaseReady,
  futureLessonDate,
  login,
} from './e2e-helpers';
import { LessonStudentChangeHistoryEntity } from '../src/modules/lessons/entities/lesson-student-change-history.entity';
import { StudentEntity } from '../src/modules/students/entities/student.entity';
import { TeacherEntity } from '../src/modules/teachers/entities/teacher.entity';
import { TeacherPaymentEntity } from '../src/modules/teacher-payments/entities/teacher-payment.entity';
import { UserEntity } from '../src/modules/users/entities/user.entity';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;
const PASSWORD = 'TestPass123!';

async function seedUser(
  ds: DataSource,
  role: string,
  email: string,
  names: { first: string; last: string },
): Promise<string> {
  const id = randomUUID();
  const now = new Date();
  await ds.getRepository(UserEntity).save({
    id,
    email,
    passwordHash: bcrypt.hashSync(PASSWORD, 10),
    role,
    status: 'active',
    emailVerified: true,
    verificationCode: null,
    verificationCodeExpiresAt: null,
    verificationCodeSentAt: null,
    verificationAttempts: 0,
    firstName: names.first,
    lastName: names.last,
    phone: '',
    telegramId: '',
    telegramUsername: '',
    telegramConnectedAt: null,
    telegramLinkToken: null,
    telegramLinkExpires: null,
    createdDate: now,
    updatedDate: now,
  });
  return id;
}

async function seedTeacher(
  ds: DataSource,
  email: string,
  name: string,
): Promise<{ userId: string; teacherId: string; token: string }> {
  const userId = await seedUser(ds, 'teacher', email, {
    first: 'Test',
    last: 'Teacher',
  });
  const teacherId = randomUUID();
  await ds.getRepository(TeacherEntity).save({
    id: teacherId,
    userId,
    name,
    firstName: 'Test',
    lastName: 'Teacher',
    email,
    status: 'active',
    phone: null,
    hourlyRate: 30,
  } as TeacherEntity);
  return { userId, teacherId, token: '' };
}

describeE2E('Lesson student reassignment (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    await ensureDatabaseReady();
    app = await createTestApp();
    const ds = app.get(DataSource);
    const suffix = randomUUID().slice(0, 8);
    const email = `swap-admin-${suffix}@test.local`;
    await seedUser(ds, 'admin', email, { first: 'Swap', last: 'Admin' });
    const session = await login(app, email, PASSWORD);
    adminToken = session.token;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('planned: owner can swap CRM student; foreign teacher gets 403', async () => {
    const ds = app.get(DataSource);
    const suffix = randomUUID().slice(0, 8);

    const teacherA = await seedTeacher(
      ds,
      `swap-a-${suffix}@test.local`,
      `Swap A ${suffix}`,
    );
    const teacherB = await seedTeacher(
      ds,
      `swap-b-${suffix}@test.local`,
      `Swap B ${suffix}`,
    );
    teacherA.token = (await login(app, `swap-a-${suffix}@test.local`, PASSWORD)).token;
    teacherB.token = (await login(app, `swap-b-${suffix}@test.local`, PASSWORD)).token;

    const studentOldId = randomUUID();
    const studentNewId = randomUUID();
    await ds.getRepository(StudentEntity).save({
      id: studentOldId,
      name: `Old ${suffix}`,
      status: 'active',
      assignedTeacherId: teacherA.teacherId,
      lessonBalance: 5,
    } as StudentEntity);
    await ds.getRepository(StudentEntity).save({
      id: studentNewId,
      name: `New ${suffix}`,
      status: 'active',
      assignedTeacherId: teacherA.teacherId,
      lessonBalance: 5,
    } as StudentEntity);

    const lessonRes = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId: teacherA.teacherId,
        primaryStudentId: studentOldId,
        date: futureLessonDate(5),
        startTime: '12:00',
        duration: 60,
        status: 'planned',
      });
    expect(lessonRes.status).toBe(201);
    const lessonId = lessonRes.body.id as string;

    const foreign = await api(app)
      .patch(`/api/lessons/${lessonId}/students`)
      .set(authHeader(teacherB.token))
      .send({ student_id: studentNewId });
    expect(foreign.status).toBe(403);

    const ok = await api(app)
      .patch(`/api/lessons/${lessonId}/students`)
      .set(authHeader(teacherA.token))
      .send({ student_id: studentNewId });
    expect(ok.status).toBe(200);
    expect(ok.body.primary_student_id || ok.body.primaryStudentId).toBe(studentNewId);

    const history = await api(app)
      .get(`/api/lessons/${lessonId}/student-changes`)
      .set(authHeader(teacherA.token));
    expect(history.status).toBe(200);
    expect(Array.isArray(history.body)).toBe(true);
    expect(history.body.length).toBeGreaterThanOrEqual(1);
    expect(
      history.body[0].balance_restored ?? history.body[0].balanceRestored,
    ).toBe(false);
  });

  it('completed: restores old balance, deducts new, does not duplicate TeacherPayment', async () => {
    const ds = app.get(DataSource);
    const suffix = randomUUID().slice(0, 8);

    const teacher = await seedTeacher(
      ds,
      `swap-pay-${suffix}@test.local`,
      `Swap Pay ${suffix}`,
    );
    teacher.token = (
      await login(app, `swap-pay-${suffix}@test.local`, PASSWORD)
    ).token;

    const studentOldId = randomUUID();
    const studentNewId = randomUUID();
    await ds.getRepository(StudentEntity).save({
      id: studentOldId,
      name: `Paid Old ${suffix}`,
      status: 'active',
      assignedTeacherId: teacher.teacherId,
      lessonBalance: 10,
    } as StudentEntity);
    await ds.getRepository(StudentEntity).save({
      id: studentNewId,
      name: `Paid New ${suffix}`,
      status: 'active',
      assignedTeacherId: teacher.teacherId,
      lessonBalance: 5,
    } as StudentEntity);

    const lessonRes = await api(app)
      .post('/api/lessons')
      .set(authHeader(adminToken))
      .send({
        teacherId: teacher.teacherId,
        primaryStudentId: studentOldId,
        date: futureLessonDate(6),
        startTime: '13:00',
        duration: 60,
        status: 'planned',
      });
    expect(lessonRes.status).toBe(201);
    const lessonId = lessonRes.body.id as string;

    const completed = await api(app)
      .patch(`/api/lessons/${lessonId}/complete`)
      .set(authHeader(adminToken));
    expect(completed.status).toBe(200);

    const afterCompleteOld = await ds.getRepository(StudentEntity).findOne({
      where: { id: studentOldId },
    });
    expect(afterCompleteOld?.lessonBalance).toBe(9);

    const paymentsBefore = await ds.getRepository(TeacherPaymentEntity).count({
      where: { lessonId },
    });
    expect(paymentsBefore).toBe(1);

    const swap = await api(app)
      .patch(`/api/lessons/${lessonId}/students`)
      .set(authHeader(teacher.token))
      .send({ student_id: studentNewId });
    expect(swap.status).toBe(200);
    expect(swap.body.primary_student_id || swap.body.primaryStudentId).toBe(
      studentNewId,
    );

    const afterOld = await ds.getRepository(StudentEntity).findOne({
      where: { id: studentOldId },
    });
    const afterNew = await ds.getRepository(StudentEntity).findOne({
      where: { id: studentNewId },
    });
    expect(afterOld?.lessonBalance).toBe(10);
    expect(afterNew?.lessonBalance).toBe(4);

    const paymentsAfter = await ds.getRepository(TeacherPaymentEntity).count({
      where: { lessonId },
    });
    expect(paymentsAfter).toBe(1);

    const historyRows = await ds
      .getRepository(LessonStudentChangeHistoryEntity)
      .find({ where: { lessonId }, order: { createdAt: 'DESC' } });
    expect(historyRows.length).toBeGreaterThanOrEqual(1);
    expect(historyRows[0].balanceRestored).toBe(true);
    expect(historyRows[0].balanceDeducted).toBe(true);
  });
});
