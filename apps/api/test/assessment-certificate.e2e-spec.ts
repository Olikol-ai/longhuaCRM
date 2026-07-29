import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
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
import { AssessmentCertificateService } from '../src/modules/certificates/assessment-certificate.service';
import { AssessmentAttemptEntity } from '../src/modules/assessment/entities/assessment-attempt.entity';
import { AssessmentExamEntity } from '../src/modules/assessment/entities/assessment-exam.entity';
import { AssessmentExamAssignmentEntity } from '../src/modules/assessment/entities/assessment-exam-assignment.entity';
import { AssessmentResultEntity } from '../src/modules/assessment/entities/assessment-result.entity';
import { AssessmentExamBlockEntity } from '../src/modules/assessment/entities/assessment-exam-block.entity';
import { AssessmentExamBlockItemEntity } from '../src/modules/assessment/entities/assessment-exam-block-item.entity';
import { AssessmentQuestionEntity } from '../src/modules/assessment/entities/assessment-question.entity';
import { AssessmentAnswerEntity } from '../src/modules/assessment/entities/assessment-answer.entity';
import { AssessmentSectionEntity } from '../src/modules/assessment/entities/assessment-section.entity';
import { AssessmentExamQuestionEntity } from '../src/modules/assessment/entities/assessment-exam-question.entity';
import {
  AssignmentStatus,
  AssignmentTargetType,
  AttemptStatus,
  ContentLifecycleStatus,
  EvaluationType,
  QuestionType,
  ResultStatus,
} from '../src/modules/assessment/enums';
import { EnrollmentEntity } from '../src/modules/courses/entities/enrollment.entity';

const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DB_PASSWORD);
const describeE2E = hasDatabase ? describe : describe.skip;

describeE2E('Assessment Result → Certificate (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    await ensureDatabaseReady();
    app = await createTestApp();
    const session = await adminLogin(app);
    adminToken = session.token;
  }, 120000);

  afterAll(async () => {
    await app?.close();
  });

  async function createStudent(label: string) {
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
      lastName: 'Cert',
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
      .send({ name: `Student ${label}`, userId, status: 'active', email })
      .expect(201);

    const session = await login(app, email, password);
    return { studentId: studentRes.body.id as string, token: session.token, email };
  }

  async function seedPassedResult(studentId: string, courseId: string) {
    const ds = app.get(DataSource);
    const question = await ds.getRepository(AssessmentQuestionEntity).save(
      ds.getRepository(AssessmentQuestionEntity).create({
        type: QuestionType.SingleChoice,
        stem: 'Demo?',
        points: '1',
        difficulty: 1,
        status: ContentLifecycleStatus.Published,
        createdByUserId: null,
      }),
    );
    await ds.getRepository(AssessmentAnswerEntity).save(
      ds.getRepository(AssessmentAnswerEntity).create({
        questionId: question.id,
        text: 'Yes',
        isCorrect: true,
        sortOrder: 0,
      }),
    );
    const block = await ds.getRepository(AssessmentExamBlockEntity).save(
      ds.getRepository(AssessmentExamBlockEntity).create({
        name: `Block ${randomUUID().slice(0, 6)}`,
        status: ContentLifecycleStatus.Published,
        createdByUserId: null,
      }),
    );
    await ds.getRepository(AssessmentExamBlockItemEntity).save(
      ds.getRepository(AssessmentExamBlockItemEntity).create({
        blockId: block.id,
        questionId: question.id,
        sortOrder: 0,
      }),
    );
    const exam = await ds.getRepository(AssessmentExamEntity).save(
      ds.getRepository(AssessmentExamEntity).create({
        name: `Exam ${randomUUID().slice(0, 6)}`,
        status: ContentLifecycleStatus.Published,
        availableFrom: null,
        availableTo: null,
        createdByUserId: null,
      }),
    );
    const section = await ds.getRepository(AssessmentSectionEntity).save(
      ds.getRepository(AssessmentSectionEntity).create({
        examId: exam.id,
        sectionKey: 'block_1',
        title: block.name,
        description: null,
        durationMinutes: null,
        levelLabel: null,
        sourceBlockId: block.id,
        weight: '100',
        sortOrder: 0,
      }),
    );
    await ds.getRepository(AssessmentExamQuestionEntity).save(
      ds.getRepository(AssessmentExamQuestionEntity).create({
        examId: exam.id,
        sectionId: section.id,
        questionId: question.id,
        sortOrder: 0,
      }),
    );
    const assignment = await ds.getRepository(AssessmentExamAssignmentEntity).save(
      ds.getRepository(AssessmentExamAssignmentEntity).create({
        examId: exam.id,
        targetType: AssignmentTargetType.Course,
        targetId: courseId,
        status: AssignmentStatus.Active,
        validFrom: null,
        validTo: null,
        assessmentRuleOverrideId: null,
        assignedByUserId: null,
      }),
    );
    const attempt = await ds.getRepository(AssessmentAttemptEntity).save(
      ds.getRepository(AssessmentAttemptEntity).create({
        examId: exam.id,
        assignmentId: assignment.id,
        status: AttemptStatus.Submitted,
        submitReason: null,
        attemptNumber: 1,
        studentId,
        teacherId: null,
        userId: randomUUID(),
        startedAt: new Date(),
        expiresAt: null,
        submittedAt: new Date(),
      }),
    );
    const result = await ds.getRepository(AssessmentResultEntity).save(
      ds.getRepository(AssessmentResultEntity).create({
        attemptId: attempt.id,
        examId: exam.id,
        status: ResultStatus.Passed,
        evaluationType: EvaluationType.Automatic,
        score: '10',
        maxScore: '10',
        percent: '100.00',
        passed: true,
        startedAt: attempt.startedAt,
        finishedAt: attempt.submittedAt,
        duration: 60,
        attemptNumber: 1,
      }),
    );
    return { result, exam };
  }

  it('passed Result creates Certificate; retry is idempotent; failed skips; student ACL', async () => {
    const studentA = await createStudent('a');
    const studentB = await createStudent('b');

    const courseRes = await api(app)
      .post('/api/courses')
      .set(authHeader(adminToken))
      .send({
        name: `Assess Cert Course ${randomUUID().slice(0, 6)}`,
        courseType: 'basic_beginner',
        totalLessons: 5,
      })
      .expect(201);
    const courseId = courseRes.body.id as string;

    await app.get(DataSource).getRepository(EnrollmentEntity).save({
      studentId: studentA.studentId,
      courseTemplateId: courseId,
      courseName: courseRes.body.name,
      completedLessons: 0,
      missedLessons: 0,
      totalLessons: 5,
      status: 'active',
      startDate: '2026-01-01',
      notes: null,
    });

    const { result } = await seedPassedResult(studentA.studentId, courseId);
    const service = app.get(AssessmentCertificateService);

    const first = await service.issueForPassedResult(result);
    expect(first).toBeTruthy();
    expect(first!.status).toBe('issued');
    expect(first!.source).toBe('assessment');
    expect(first!.assessmentResultId).toBe(result.id);
    expect(first!.studentId).toBe(studentA.studentId);
    expect(first!.courseId).toBe(courseId);

    const second = await service.issueForPassedResult(result);
    expect(second!.id).toBe(first!.id);

    const failed = await service.issueForPassedResult({
      ...result,
      id: randomUUID(),
      status: ResultStatus.Failed,
      passed: false,
    });
    expect(failed).toBeNull();

    const listA = await api(app)
      .get('/api/certificates')
      .set(authHeader(studentA.token))
      .expect(200);
    const idsA = (listA.body as Array<{ id: string }>).map((c) => c.id);
    expect(idsA).toContain(first!.id);

    const listB = await api(app)
      .get('/api/certificates')
      .set(authHeader(studentB.token))
      .expect(200);
    const idsB = (listB.body as Array<{ id: string }>).map((c) => c.id);
    expect(idsB).not.toContain(first!.id);
  }, 180000);
});
