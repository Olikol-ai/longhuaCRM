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
import { StudentEntity } from '../src/modules/students/entities/student.entity';
import { TutorEntity } from '../src/modules/tutors/entities/tutor.entity';
import { TutorStudentEntity } from '../src/modules/tutors/entities/tutor-student.entity';
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

async function ensureHomeworkTutorSchema(ds: DataSource): Promise<void> {
  await ds.query(`
    ALTER TABLE homeworks
    ADD COLUMN IF NOT EXISTS tutor_id uuid NULL
  `);
  await ds.query(`
    ALTER TABLE homework_assignments
    ALTER COLUMN student_id DROP NOT NULL
  `);
  await ds.query(`
    ALTER TABLE homework_assignments
    ADD COLUMN IF NOT EXISTS tutor_student_id uuid NULL,
    ADD COLUMN IF NOT EXISTS manual_status varchar(32) NULL,
    ADD COLUMN IF NOT EXISTS review_result text NULL,
    ADD COLUMN IF NOT EXISTS owner_comment text NULL,
    ADD COLUMN IF NOT EXISTS manual_checked_at timestamptz NULL,
    ADD COLUMN IF NOT EXISTS returned_for_revision_at timestamptz NULL
  `);
  await ds.query(`
    ALTER TABLE homework_attempts
    ALTER COLUMN student_id DROP NOT NULL
  `);
  await ds.query(`
    ALTER TABLE homework_attempts
    ADD COLUMN IF NOT EXISTS tutor_student_id uuid NULL
  `);

  await ds.query(`
    ALTER TABLE homework_results
    ALTER COLUMN attempt_id DROP NOT NULL
  `);

  await ds.query(`
    ALTER TABLE homework_results
    ALTER COLUMN score DROP NOT NULL,
    ALTER COLUMN max_score DROP NOT NULL,
    ALTER COLUMN percent DROP NOT NULL,
    ALTER COLUMN passed DROP NOT NULL
  `);

  await ds.query(`
    ALTER TABLE homework_results
    ADD COLUMN IF NOT EXISTS owner_comment text NULL,
    ADD COLUMN IF NOT EXISTS review_result text NULL,
    ADD COLUMN IF NOT EXISTS completed_at timestamptz NULL,
    ADD COLUMN IF NOT EXISTS checked_at timestamptz NULL
  `);
}

describeE2E('Homework module (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await ensureDatabaseReady();
    app = await createTestApp();
    await ensureHomeworkTutorSchema(app.get(DataSource));
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

    const teacherLogin = await login(app, `hw-teacher-${suffix}@test.local`, PASSWORD);
    const studentLogin = await login(app, `hw-student-${suffix}@test.local`, PASSWORD);

    const createRes = await api(app)
      .post('/api/homework')
      .set(authHeader(teacherLogin.token))
      .send({
        title: 'Урок 8. Лексика HSK2',
        instructions: 'Ответьте на вопросы.',
        activity_kind: 'test',
        items: [
          {
            type: 'single_choice',
            stem: 'Что означает 你好?',
            points: 1,
            section_key: 'test',
            sort_order: 0,
            answers: [
              { text: 'Привет', is_correct: true, sort_order: 0 },
              { text: 'Пока', is_correct: false, sort_order: 1 },
            ],
          },
        ],
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

  it('supports tutor-owned homework with registered/local tutor students and ACL boundaries', async () => {
    const ds = app.get(DataSource);
    const suffix = randomUUID().slice(0, 8);

    const tutorUserId = await seedUser(ds, 'tutor', `hw-tutor-${suffix}@test.local`, {
      first: 'Ли',
      last: 'Репетитор',
    });
    const otherTutorUserId = await seedUser(ds, 'tutor', `hw-other-tutor-${suffix}@test.local`, {
      first: 'Чужой',
      last: 'Репетитор',
    });
    const tutorStudentUserId = await seedUser(ds, 'tutor_student', `hw-tutor-student-${suffix}@test.local`, {
      first: 'Чэнь',
      last: 'Ученик',
    });
    const teacherUserId = await seedUser(ds, 'teacher', `hw-teacher-guard-${suffix}@test.local`, {
      first: 'Школьный',
      last: 'Учитель',
    });
    const adminUserId = await seedUser(ds, 'admin', `hw-admin-${suffix}@test.local`, {
      first: 'Главный',
      last: 'Админ',
    });

    const tutor = await ds.getRepository(TutorEntity).save({
      id: randomUUID(),
      userId: tutorUserId,
      displayName: 'Петров П.П.',
      status: 'active',
      email: `hw-tutor-${suffix}@test.local`,
      phone: null,
      bio: null,
      teachingExperience: null,
      specialization: null,
      specializations: null,
      defaultLessonPrice: null,
      commissionPercent: 1,
      payoutAccountRef: null,
    } as TutorEntity);
    const otherTutor = await ds.getRepository(TutorEntity).save({
      id: randomUUID(),
      userId: otherTutorUserId,
      displayName: 'Сидоров С.С.',
      status: 'active',
      email: `hw-other-tutor-${suffix}@test.local`,
      phone: null,
      bio: null,
      teachingExperience: null,
      specialization: null,
      specializations: null,
      defaultLessonPrice: null,
      commissionPercent: 1,
      payoutAccountRef: null,
    } as TutorEntity);
    await ds.getRepository(TeacherEntity).save({
      id: randomUUID(),
      userId: teacherUserId,
      name: 'Школьный Учитель',
      firstName: 'Школьный',
      lastName: 'Учитель',
      email: `hw-teacher-guard-${suffix}@test.local`,
      status: 'active',
      phone: null,
      hourlyRate: null,
    } as TeacherEntity);

    const registeredTutorStudent = await ds.getRepository(TutorStudentEntity).save({
      id: randomUUID(),
      tutorId: tutor.id,
      userId: tutorStudentUserId,
      name: 'Чэнь Ученик',
      firstName: 'Чэнь',
      lastName: 'Ученик',
      email: `hw-tutor-student-${suffix}@test.local`,
      phone: null,
      notes: null,
      telegramId: null,
      telegramUsername: null,
      status: 'active',
      inviteLinkId: null,
    } as TutorStudentEntity);
    const localTutorStudent = await ds.getRepository(TutorStudentEntity).save({
      id: randomUUID(),
      tutorId: tutor.id,
      userId: null,
      name: 'Локальный Ученик',
      firstName: 'Локальный',
      lastName: 'Ученик',
      email: null,
      phone: null,
      notes: null,
      telegramId: null,
      telegramUsername: null,
      status: 'active',
      inviteLinkId: null,
    } as TutorStudentEntity);
    const foreignTutorStudent = await ds.getRepository(TutorStudentEntity).save({
      id: randomUUID(),
      tutorId: otherTutor.id,
      userId: null,
      name: 'Чужой Ученик',
      firstName: 'Чужой',
      lastName: 'Ученик',
      email: null,
      phone: null,
      notes: null,
      telegramId: null,
      telegramUsername: null,
      status: 'active',
      inviteLinkId: null,
    } as TutorStudentEntity);

    const tutorLogin = await login(app, `hw-tutor-${suffix}@test.local`, PASSWORD);
    const otherTutorLogin = await login(app, `hw-other-tutor-${suffix}@test.local`, PASSWORD);
    const tutorStudentLogin = await login(app, `hw-tutor-student-${suffix}@test.local`, PASSWORD);
    const teacherLogin = await login(app, `hw-teacher-guard-${suffix}@test.local`, PASSWORD);
    const adminLogin = await login(app, `hw-admin-${suffix}@test.local`, PASSWORD);

    const createRes = await api(app)
      .post('/api/homework')
      .set(authHeader(tutorLogin.token))
      .send({
        title: 'Китайский язык. Домашняя работа',
        instructions: 'Выберите правильный ответ.',
        activity_kind: 'test',
        items: [
          {
            type: 'single_choice',
            stem: 'Выберите перевод 你好',
            points: 1,
            section_key: 'test',
            sort_order: 0,
            answers: [
              { text: 'Привет', is_correct: true, sort_order: 0 },
              { text: 'Пока', is_correct: false, sort_order: 1 },
            ],
          },
        ],
      })
      .expect(201);

    const homeworkId = createRes.body.id;
    expect(createRes.body.owner_type).toBe('tutor');
    expect(createRes.body.owner_name).toBe('Петров П.П.');

    await api(app)
      .post(`/api/homework/${homeworkId}/publish`)
      .set(authHeader(tutorLogin.token))
      .expect(201);

    await api(app)
      .post(`/api/homework/${homeworkId}/assign`)
      .set(authHeader(tutorLogin.token))
      .send({ tutor_student_ids: [foreignTutorStudent.id] })
      .expect(403);

    const assignRes = await api(app)
      .post(`/api/homework/${homeworkId}/assign`)
      .set(authHeader(tutorLogin.token))
      .send({
        tutor_student_ids: [registeredTutorStudent.id, localTutorStudent.id],
      })
      .expect(201);

    expect(assignRes.body).toHaveLength(2);
    const registeredAssignment = assignRes.body.find(
      (row: { tutor_student_id: string }) => row.tutor_student_id === registeredTutorStudent.id,
    );
    const localAssignment = assignRes.body.find(
      (row: { tutor_student_id: string }) => row.tutor_student_id === localTutorStudent.id,
    );
    expect(registeredAssignment.owner_type).toBe('tutor');
    expect(localAssignment.learner_has_account).toBe(false);

    await api(app)
      .get(`/api/homework/${homeworkId}`)
      .set(authHeader(teacherLogin.token))
      .expect(403);

    const tutorStudentCards = await api(app)
      .get('/api/homework/assignments/mine')
      .set(authHeader(tutorStudentLogin.token))
      .expect(200);
    expect(tutorStudentCards.body).toHaveLength(1);
    expect(tutorStudentCards.body[0].owner_type).toBe('tutor');
    expect(tutorStudentCards.body[0].owner_name).toBe('Петров П.П.');

    const startRes = await api(app)
      .post(`/api/homework/assignments/${registeredAssignment.id}/start`)
      .set(authHeader(tutorStudentLogin.token))
      .expect(201);
    const correctSnap = startRes.body.questions[0].answers.find(
      (row: { body: string }) => row.body === 'Привет',
    );
    const submitRes = await api(app)
      .post(`/api/homework/attempts/${startRes.body.id}/submit`)
      .set(authHeader(tutorStudentLogin.token))
      .send({
        answers: [
          {
            question_snapshot_id: startRes.body.questions[0].id,
            selected_answer_snapshot_ids: [correctSnap.id],
          },
        ],
      })
      .expect(201);
    expect(submitRes.body.result.percent).toBe(100);

    const tutorNotifs = await ds.getRepository(NotificationEntity).find({
      where: { userId: tutorUserId, type: 'homework_submitted' },
    });
    expect(tutorNotifs.length).toBeGreaterThanOrEqual(1);

    const localStatusRes = await api(app)
      .patch(`/api/homework/assignments/${localAssignment.id}/local-status`)
      .set(authHeader(tutorLogin.token))
      .send({
        status: 'reviewed',
        comment: 'Проверено вручную',
        result: 'Сделано на занятии',
      })
      .expect(200);
    expect(localStatusRes.body.manual_status).toBe('reviewed');
    expect(localStatusRes.body.review_result).toBe('Сделано на занятии');

    const localResultRes = await api(app)
      .get(`/api/homework/assignments/${localAssignment.id}/result`)
      .set(authHeader(tutorLogin.token))
      .expect(200);
    expect(localResultRes.body.result.manual).toBe(true);
    expect(localResultRes.body.result.review_result).toBe('Сделано на занятии');

    const adminList = await api(app)
      .get('/api/homework')
      .set(authHeader(adminLogin.token))
      .expect(200);
    expect(adminList.body.some((row: { id: string }) => row.id === homeworkId)).toBe(true);

    const otherTutorList = await api(app)
      .get('/api/homework')
      .set(authHeader(otherTutorLogin.token))
      .expect(200);
    expect(otherTutorList.body.some((row: { id: string }) => row.id === homeworkId)).toBe(false);
  });
});
