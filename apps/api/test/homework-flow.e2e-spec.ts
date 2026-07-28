import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import {
  api,
  authHeader,
  createTestApp,
  ensureDatabaseReady,
  login,
} from './e2e-helpers';
import { ContentLifecycleStatus, QuestionType } from '../src/modules/assessment/enums';
import { AssessmentBankEntity } from '../src/modules/assessment/entities/assessment-bank.entity';
import { AssessmentQuestionEntity } from '../src/modules/assessment/entities/assessment-question.entity';
import { AssessmentAnswerEntity } from '../src/modules/assessment/entities/assessment-answer.entity';
import { TeacherEntity } from '../src/modules/teachers/entities/teacher.entity';
import { StudentEntity } from '../src/modules/students/entities/student.entity';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { NotificationEntity } from '../src/modules/notifications/entities/notification.entity';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;
const PASSWORD = 'TestPass123!';

async function seedUser(
  ds: DataSource,
  role: string,
  email: string,
  names: { first: string; last: string },
) {
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

describeE2E('Homework module (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await ensureDatabaseReady();
    app = await createTestApp();
  }, 180000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('creates, assigns, submits with auto-score and notifies teacher', async () => {
    const ds = app.get(DataSource);
    const suffix = randomUUID().slice(0, 8);

    const teacherUserId = await seedUser(ds, 'teacher', `hw-teacher-${suffix}@test.local`, {
      first: 'Пётр',
      last: 'Учитель',
    });
    const studentUserId = await seedUser(ds, 'student', `hw-student-${suffix}@test.local`, {
      first: 'Иван',
      last: 'Иванов',
    });

    const teacher = await ds.getRepository(TeacherEntity).save({
      id: randomUUID(),
      userId: teacherUserId,
      name: 'Учитель Пётр',
      firstName: 'Пётр',
      lastName: 'Учитель',
      email: `hw-teacher-${suffix}@test.local`,
      status: 'active',
      phone: null,
      hourlyRate: null,
    } as TeacherEntity);

    const student = await ds.getRepository(StudentEntity).save({
      id: randomUUID(),
      userId: studentUserId,
      name: 'Иванов Иван',
      firstName: 'Иван',
      lastName: 'Иванов',
      email: `hw-student-${suffix}@test.local`,
      status: 'active',
      phone: null,
      assignedTeacherId: teacher.id,
    } as StudentEntity);

    const bank = await ds.getRepository(AssessmentBankEntity).save({
      id: randomUUID(),
      name: `HW Bank ${suffix}`,
      description: null,
      status: ContentLifecycleStatus.Published,
      createdByUserId: teacherUserId,
    } as AssessmentBankEntity);

    const question = await ds.getRepository(AssessmentQuestionEntity).save({
      id: randomUUID(),
      bankId: bank.id,
      type: QuestionType.SingleChoice,
      stem: 'Что означает 你好?',
      points: '1',
      difficulty: 1,
      explanation: null,
      status: ContentLifecycleStatus.Published,
      createdByUserId: teacherUserId,
    } as AssessmentQuestionEntity);

    const correct = await ds.getRepository(AssessmentAnswerEntity).save({
      id: randomUUID(),
      questionId: question.id,
      text: 'Привет',
      isCorrect: true,
      sortOrder: 0,
    } as AssessmentAnswerEntity);
    await ds.getRepository(AssessmentAnswerEntity).save({
      id: randomUUID(),
      questionId: question.id,
      text: 'Пока',
      isCorrect: false,
      sortOrder: 1,
    } as AssessmentAnswerEntity);

    const teacherLogin = await login(app, `hw-teacher-${suffix}@test.local`, PASSWORD);
    const studentLogin = await login(app, `hw-student-${suffix}@test.local`, PASSWORD);

    const createRes = await api(app)
      .post('/api/homework')
      .set(authHeader(teacherLogin.token))
      .send({
        title: 'Урок 8. Лексика HSK2',
        instructions: 'Ответьте на вопросы.',
        activity_kind: 'test',
        items: [{ question_id: question.id, section_key: 'test', sort_order: 0 }],
      })
      .expect(201);

    const homeworkId = createRes.body.id;
    await api(app)
      .post(`/api/homework/${homeworkId}/publish`)
      .set(authHeader(teacherLogin.token))
      .expect(201);

    const assignRes = await api(app)
      .post(`/api/homework/${homeworkId}/assign`)
      .set(authHeader(teacherLogin.token))
      .send({ student_ids: [student.id] })
      .expect(201);

    const assignmentId = Array.isArray(assignRes.body)
      ? assignRes.body[0].id
      : assignRes.body.id;

    const startRes = await api(app)
      .post(`/api/homework/assignments/${assignmentId}/start`)
      .set(authHeader(studentLogin.token))
      .expect(201);

    const attemptId = startRes.body.id;
    const qSnap = startRes.body.questions[0];
    const correctSnap = qSnap.answers.find(
      (a: { body: string }) => a.body === 'Привет',
    );

    const submitRes = await api(app)
      .post(`/api/homework/attempts/${attemptId}/submit`)
      .set(authHeader(studentLogin.token))
      .send({
        answers: [
          {
            question_snapshot_id: qSnap.id,
            selected_answer_snapshot_ids: [correctSnap.id],
          },
        ],
      })
      .expect(201);

    expect(submitRes.body.result.percent).toBe(100);
    expect(submitRes.body.result.score).toBe(1);
    expect(submitRes.body.status).toBe('submitted');

    const teacherNotifs = await ds.getRepository(NotificationEntity).find({
      where: { userId: teacherUserId, type: 'homework_submitted' },
    });
    expect(teacherNotifs.length).toBeGreaterThanOrEqual(1);
    expect(teacherNotifs[0].body).toMatch(/Иванов/);
    expect(teacherNotifs[0].body).toMatch(/Урок 8/);

    const resultRes = await api(app)
      .get(`/api/homework/assignments/${assignmentId}/result`)
      .set(authHeader(teacherLogin.token))
      .expect(200);
    expect(resultRes.body.result.percent).toBe(100);
  });
});
