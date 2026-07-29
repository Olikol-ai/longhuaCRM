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
import { TeacherEntity } from '../src/modules/teachers/entities/teacher.entity';
import { TutorEntity } from '../src/modules/tutors/entities/tutor.entity';
import { UserEntity } from '../src/modules/users/entities/user.entity';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;
const PASSWORD = 'TestPass123!';

async function seedUser(
  ds: DataSource,
  role: string,
  email: string,
  firstName: string,
  lastName: string,
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
    firstName,
    lastName,
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

describeE2E('Assessment authoring ACL (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await ensureDatabaseReady();
    app = await createTestApp();
  }, 180000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('isolates questions and exam authoring between teacher and tutor owners', async () => {
    const ds = app.get(DataSource);
    const suffix = randomUUID().slice(0, 8);

    const teacherUserId = await seedUser(
      ds,
      'teacher',
      `assessment-teacher-${suffix}@test.local`,
      'Teacher',
      'Owner',
    );
    const otherTeacherUserId = await seedUser(
      ds,
      'teacher',
      `assessment-teacher-other-${suffix}@test.local`,
      'Teacher',
      'Other',
    );
    const tutorUserId = await seedUser(
      ds,
      'tutor',
      `assessment-tutor-${suffix}@test.local`,
      'Tutor',
      'Owner',
    );

    await ds.getRepository(TeacherEntity).save([
      {
        id: randomUUID(),
        userId: teacherUserId,
        name: 'Teacher Owner',
        firstName: 'Teacher',
        lastName: 'Owner',
        email: `assessment-teacher-${suffix}@test.local`,
        status: 'active',
        phone: null,
        hourlyRate: null,
      } as TeacherEntity,
      {
        id: randomUUID(),
        userId: otherTeacherUserId,
        name: 'Teacher Other',
        firstName: 'Teacher',
        lastName: 'Other',
        email: `assessment-teacher-other-${suffix}@test.local`,
        status: 'active',
        phone: null,
        hourlyRate: null,
      } as TeacherEntity,
    ]);
    await ds.getRepository(TutorEntity).save({
      id: randomUUID(),
      userId: tutorUserId,
      displayName: 'Tutor Owner',
      status: 'active',
      email: `assessment-tutor-${suffix}@test.local`,
      phone: null,
      bio: null,
      teachingExperience: null,
      specialization: null,
      specializations: null,
      defaultLessonPrice: null,
      commissionPercent: 1,
      payoutAccountRef: null,
    } as TutorEntity);

    const teacherLogin = await login(app, `assessment-teacher-${suffix}@test.local`, PASSWORD);
    const otherTeacherLogin = await login(
      app,
      `assessment-teacher-other-${suffix}@test.local`,
      PASSWORD,
    );
    const tutorLogin = await login(app, `assessment-tutor-${suffix}@test.local`, PASSWORD);

    const teacherQuestion = await api(app)
      .post('/api/assessment/questions')
      .set(authHeader(teacherLogin.token))
      .send({
        type: 'single_choice',
        stem: 'Teacher question',
        points: 1,
        answers: [
          { text: 'Correct', is_correct: true },
          { text: 'Wrong', is_correct: false },
        ],
      })
      .expect(201);
    expect(teacherQuestion.body.created_by_user_id).toBe(teacherUserId);

    await api(app)
      .get(`/api/assessment/questions/${teacherQuestion.body.id}`)
      .set(authHeader(otherTeacherLogin.token))
      .expect(403);
    await api(app)
      .get(`/api/assessment/questions/${teacherQuestion.body.id}`)
      .set(authHeader(tutorLogin.token))
      .expect(403);

    const teacherList = await api(app)
      .get('/api/assessment/questions')
      .set(authHeader(teacherLogin.token))
      .expect(200);
    expect(
      teacherList.body.items.some((item: { id: string }) => item.id === teacherQuestion.body.id),
    ).toBe(true);

    const tutorList = await api(app)
      .get('/api/assessment/questions')
      .set(authHeader(tutorLogin.token))
      .expect(200);
    expect(
      tutorList.body.items.some((item: { id: string }) => item.id === teacherQuestion.body.id),
    ).toBe(false);

    await api(app)
      .post(`/api/assessment/questions/${teacherQuestion.body.id}/publish`)
      .set(authHeader(teacherLogin.token))
      .expect(201);

    await api(app)
      .post('/api/assessment/questions')
      .set(authHeader(tutorLogin.token))
      .send({
        type: 'single_choice',
        stem: 'Tutor own question',
        points: 1,
        answers: [
          { text: 'A', is_correct: true },
          { text: 'B', is_correct: false },
        ],
      })
      .expect(201);

    const teacherBlock = await api(app)
      .post('/api/assessment/blocks')
      .set(authHeader(teacherLogin.token))
      .send({
        name: 'Teacher Block',
        question_ids: [teacherQuestion.body.id],
      })
      .expect(201);
    await api(app)
      .post(`/api/assessment/blocks/${teacherBlock.body.id}/publish`)
      .set(authHeader(teacherLogin.token))
      .expect(201);

    await api(app)
      .post('/api/assessment/blocks')
      .set(authHeader(tutorLogin.token))
      .send({
        name: 'Foreign Tutor Block',
        question_ids: [teacherQuestion.body.id],
      })
      .expect(403);

    await api(app)
      .post('/api/assessment/exams')
      .set(authHeader(tutorLogin.token))
      .send({
        block_ids: [teacherBlock.body.id],
        name: 'Foreign Tutor Exam',
        rule: {
          duration_minutes: 30,
          max_attempts: 1,
          pass_score_percent: 60,
          passing_mode: 'percent',
        },
      })
      .expect(403);

    await api(app)
      .post('/api/assessment/exams')
      .set(authHeader(teacherLogin.token))
      .send({
        block_ids: [teacherBlock.body.id],
        name: 'Teacher Exam',
        rule: {
          duration_minutes: 30,
          max_attempts: 1,
          pass_score_percent: 60,
          passing_mode: 'percent',
        },
      })
      .expect(201);
  });

  it('rejects student API access to assessment authoring endpoints', async () => {
    const ds = app.get(DataSource);
    const suffix = randomUUID().slice(0, 8);
    await seedUser(
      ds,
      'student',
      `assessment-student-${suffix}@test.local`,
      'Student',
      'NoAccess',
    );
    const studentLogin = await login(
      app,
      `assessment-student-${suffix}@test.local`,
      PASSWORD,
    );

    await api(app)
      .get('/api/assessment/questions')
      .set(authHeader(studentLogin.token))
      .expect(403);
    await api(app)
      .post('/api/assessment/questions')
      .set(authHeader(studentLogin.token))
      .send({
        type: 'single_choice',
        stem: 'Nope',
        answers: [
          { text: 'A', is_correct: true },
          { text: 'B', is_correct: false },
        ],
      })
      .expect(403);
    await api(app)
      .get('/api/assessment/blocks')
      .set(authHeader(studentLogin.token))
      .expect(403);
  });
});
