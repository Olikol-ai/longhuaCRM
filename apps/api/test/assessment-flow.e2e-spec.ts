import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import {
  adminLogin,
  api,
  authHeader,
  createTestApp,
  ensureDatabaseReady,
  login,
} from './e2e-helpers';
import { UserEntity } from '../src/modules/users/entities/user.entity';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

async function createStudentWithUser(
  app: INestApplication,
  adminToken: string,
  label: string,
): Promise<{ studentId: string; token: string; email: string }> {
  const ds = app.get(DataSource);
  const userId = randomUUID();
  const email = `${label}-${randomUUID().slice(0, 8)}@test.local`;
  const password = 'StudentPass123!';
  const now = new Date();

  await ds.getRepository(UserEntity).save({
    id: userId,
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    role: 'student',
    status: 'active',
    emailVerified: true,
    verificationCode: null,
    verificationCodeExpiresAt: null,
    verificationCodeSentAt: null,
    verificationAttempts: 0,
    firstName: 'Assess',
    lastName: label,
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

  const studentRes = await api(app)
    .post('/api/students')
    .set(authHeader(adminToken))
    .send({ name: `Student ${label}`, userId, email, status: 'active' })
    .expect(201);

  const session = await login(app, email, password);
  return { studentId: studentRes.body.id, token: session.token, email };
}

function mcAnswers(correctIndex: number, options: string[]) {
  return options.map((text, index) => ({
    text,
    is_correct: index === correctIndex,
    sort_order: index,
  }));
}

function multiAnswers(correctIndexes: number[], options: string[]) {
  const set = new Set(correctIndexes);
  return options.map((text, index) => ({
    text,
    is_correct: set.has(index),
    sort_order: index,
  }));
}

describeE2E('Assessment full flow (e2e)', () => {
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

  it('admin creates exam+assignment; student starts, autosaves, submits; result scored', async () => {
    const suffix = randomUUID().slice(0, 8);
    const auth = authHeader(adminToken);

    // ── Bank + questions ───────────────────────────────────────────────
    const bankRes = await api(app)
      .post('/api/assessment/banks')
      .set(auth)
      .send({ name: `E2E Bank ${suffix}`, description: 'assessment e2e', locale: 'ru' })
      .expect(201);
    const bankId = bankRes.body.id as string;
    await api(app).post(`/api/assessment/banks/${bankId}/publish`).set(auth).expect((res) => {
      expect([200, 201]).toContain(res.status);
    });

    const questionSpecs: Array<{
      type: string;
      stem: string;
      answers: ReturnType<typeof mcAnswers>;
    }> = [];

    for (let i = 1; i <= 5; i += 1) {
      questionSpecs.push({
        type: 'listening',
        stem: `E2E Listening ${i} ${suffix}`,
        answers: mcAnswers(0, [`OK ${i}`, 'Bad A', 'Bad B', 'Bad C']),
      });
    }
    for (let i = 1; i <= 3; i += 1) {
      questionSpecs.push({
        type: 'single_choice',
        stem: `E2E SC ${i} ${suffix}`,
        answers: mcAnswers(1, ['A', 'Correct', 'C', 'D']),
      });
    }
    for (let i = 1; i <= 2; i += 1) {
      questionSpecs.push({
        type: 'multiple_choice',
        stem: `E2E MC ${i} ${suffix}`,
        answers: multiAnswers([0, 2], ['Yes1', 'No', 'Yes2', 'No2']),
      });
    }

    const questionIds: string[] = [];
    for (const spec of questionSpecs) {
      const qRes = await api(app)
        .post('/api/assessment/questions')
        .set(auth)
        .send({
          bank_id: bankId,
          type: spec.type,
          stem: spec.stem,
          points: 1,
          difficulty: 1,
          answers: spec.answers,
        })
        .expect(201);
      questionIds.push(qRes.body.id as string);
      await api(app)
        .post(`/api/assessment/questions/${qRes.body.id}/publish`)
        .set(auth)
        .expect((res) => {
          expect([200, 201]).toContain(res.status);
        });
    }

    // ── ExamBlocks ─────────────────────────────────────────────────────
    const listeningIds = questionIds.slice(0, 5);
    const readingIds = questionIds.slice(5);
    const listeningBlock = await api(app)
      .post('/api/assessment/blocks')
      .set(auth)
      .send({
        name: `E2E Listening Block ${suffix}`,
        level_label: 'HSK1',
        question_ids: listeningIds,
      })
      .expect(201);
    await api(app)
      .post(`/api/assessment/blocks/${listeningBlock.body.id}/publish`)
      .set(auth)
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const readingBlock = await api(app)
      .post('/api/assessment/blocks')
      .set(auth)
      .send({
        name: `E2E Reading Block ${suffix}`,
        level_label: 'HSK1',
        question_ids: readingIds,
      })
      .expect(201);
    await api(app)
      .post(`/api/assessment/blocks/${readingBlock.body.id}/publish`)
      .set(auth)
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    // ── Exam ───────────────────────────────────────────────────────────
    const examRes = await api(app)
      .post('/api/assessment/exams')
      .set(auth)
      .send({
        block_ids: [listeningBlock.body.id, readingBlock.body.id],
        name: `E2E Exam ${suffix}`,
        rule: {
          duration_minutes: 30,
          max_attempts: 2,
          allow_retake: true,
          retake_policy: 'best',
          allow_review: false,
          show_result_after_submit: true,
          show_correct_answers: 'never',
          auto_submit_on_timeout: true,
          allow_pause: false,
          randomize_questions: false,
          randomize_answers: false,
          passing_mode: 'percent',
          pass_score_percent: 60,
          allow_navigation: true,
        },
      })
      .expect(201);
    const examId = examRes.body.id as string;

    await api(app)
      .post(`/api/assessment/exams/${examId}/publish`)
      .set(auth)
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });


    // ── Student + Assignment ───────────────────────────────────────────
    const student = await createStudentWithUser(app, adminToken, `assess-${suffix}`);

    const assignRes = await api(app)
      .post('/api/assessment/assignments')
      .set(auth)
      .send({
        exam_id: examId,
        target_type: 'student',
        target_id: student.studentId,
      })
      .expect(201);
    const assignmentId = assignRes.body.id as string;
    expect(assignRes.body.status).toMatch(/active|scheduled|draft/);

    // Student sees assignment
    const studentAssignments = await api(app)
      .get('/api/assessment/assignments')
      .set(authHeader(student.token))
      .expect(200);
    const items = studentAssignments.body.items ?? studentAssignments.body;
    expect(Array.isArray(items)).toBe(true);
    expect(items.some((a: { id: string }) => a.id === assignmentId)).toBe(true);

    // ── Start attempt + snapshot ───────────────────────────────────────
    const startRes = await api(app)
      .post('/api/assessment/attempts')
      .set(authHeader(student.token))
      .send({ exam_id: examId, assignment_id: assignmentId })
      .expect(201);

    const attemptId = startRes.body.id as string;
    expect(startRes.body.status).toBe('started');
    expect(Array.isArray(startRes.body.sections)).toBe(true);
    expect(startRes.body.sections.length).toBeGreaterThanOrEqual(2);

    const stateRes = await api(app)
      .get(`/api/assessment/attempts/${attemptId}`)
      .set(authHeader(student.token))
      .expect(200);
    expect(stateRes.body.id).toBe(attemptId);

    const snapRes = await api(app)
      .get(`/api/assessment/attempts/${attemptId}/snapshots`)
      .set(authHeader(student.token))
      .expect(200);
    expect(Array.isArray(snapRes.body.question_snapshots)).toBe(true);
    expect(snapRes.body.question_snapshots.length).toBe(10);

    // ── Autosave correct answers ───────────────────────────────────────
    const answersPayload: Array<{
      question_snapshot_id: string;
      selected_answer_snapshot_ids: string[];
      text?: string | null;
    }> = [];

    for (const section of stateRes.body.sections) {
      for (const q of section.questions) {
        const correct = (q.answers || []).filter(
          (a: { is_correct?: boolean; snapshot_id: string }) => a.is_correct === true,
        );
        // Student AttemptState must not expose is_correct — select by known option text
        const options = [...(q.answers || [])].sort(
          (a: { sort_order?: number }, b: { sort_order?: number }) =>
            (a.sort_order ?? 0) - (b.sort_order ?? 0),
        );

        let selected: string[] = [];
        if (q.type === 'multiple_choice') {
          // Demo/e2e MC: indexes 0 and 2 are correct
          selected = [options[0].snapshot_id, options[2].snapshot_id];
        } else if (q.type === 'listening') {
          selected = [options[0].snapshot_id];
        } else {
          // single_choice: index 1 is correct
          selected = [options[1].snapshot_id];
        }

        // Prefer is_correct if API ever includes it for authoring roles (student should not)
        if (correct.length > 0) {
          selected = correct.map((a: { snapshot_id: string }) => a.snapshot_id);
        }

        answersPayload.push({
          question_snapshot_id: q.snapshot_id,
          selected_answer_snapshot_ids: selected,
        });
      }
    }

    expect(answersPayload.length).toBe(10);

    const saveRes = await api(app)
      .patch(`/api/assessment/attempts/${attemptId}/answers`)
      .set(authHeader(student.token))
      .send({ answers: answersPayload });
    expect([200, 201]).toContain(saveRes.status);
    expect(saveRes.body.count).toBe(10);

    // ── Submit ─────────────────────────────────────────────────────────
    const submitRes = await api(app)
      .post(`/api/assessment/attempts/${attemptId}/submit`)
      .set(authHeader(student.token))
      .send({ answers: answersPayload });
    expect([200, 201]).toContain(submitRes.status);

    expect(submitRes.body.attempt?.status ?? submitRes.body.status).toBe('submitted');
    const result = submitRes.body.result;
    expect(result).toBeDefined();
    expect(result.id).toBeTruthy();
    expect(Number(result.score)).toBeGreaterThanOrEqual(0);
    expect(Number(result.max_score)).toBe(10);
    expect(Number(result.percent)).toBeGreaterThanOrEqual(60);
    expect(result.status === 'passed' || result.passed === true).toBe(true);

    const resultByAttempt = await api(app)
      .get(`/api/assessment/attempts/${attemptId}/result`)
      .set(authHeader(student.token));
    expect([200, 201]).toContain(resultByAttempt.status);
    expect(resultByAttempt.body.id).toBe(result.id);
    expect(resultByAttempt.body.status).toBe('passed');
  }, 180000);
});
