import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import { CourseTemplateEntity } from '../../courses/entities/course-template.entity';
import { EnrollmentEntity } from '../../courses/entities/enrollment.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { StudentsService } from '../../students/students.service';
import {
  AssignmentTargetType,
  ContentLifecycleStatus,
  PassingMode,
  QuestionType,
  RetakePolicy,
  ShowCorrectAnswers,
} from '../enums';
import { AssessmentBankService } from '../services/assessment-bank.service';
import { QuestionAuthoringService } from '../services/question-authoring.service';
import { ExamBlockService } from '../services/exam-block.service';
import { ExamService } from '../services/exam.service';
import { AssignmentService } from '../services/assignment.service';

/** Stable demo labels — used for idempotent re-runs. */
export const ASSESSMENT_DEMO = {
  examName: 'Вступительный экзамен HSK 1',
  bankName: 'Банк вопросов HSK 1',
  listeningBlockName: 'Блок: Аудирование HSK 1',
  readingBlockName: 'Блок: Чтение HSK 1',
  courseName: 'Курс китайского HSK 1',
  studentEmail: 'uchenik.demo@longhua.local',
  studentPassword: 'DemoStudent123!',
  studentName: 'Иванов Алексей',
} as const;

export type AssessmentDemoSeedResult = {
  skipped: boolean;
  bankId: string;
  blockIds: string[];
  examId: string;
  assignmentId: string;
  studentId: string;
  studentEmail: string;
  studentPassword: string;
  questionIds: string[];
};

export type AssessmentDemoSeedDeps = {
  dataSource: DataSource;
  banks: AssessmentBankService;
  questions: QuestionAuthoringService;
  blocks: ExamBlockService;
  exams: ExamService;
  assignments: AssignmentService;
  students: StudentsService;
  actor: DomainAccessActor;
  logger?: Logger;
};

function mcAnswers(correctIndex: number, options: string[]) {
  return options.map((text, index) => ({
    text,
    isCorrect: index === correctIndex,
    sortOrder: index,
  }));
}

function multiAnswers(correctIndexes: number[], options: string[]) {
  const set = new Set(correctIndexes);
  return options.map((text, index) => ({
    text,
    isCorrect: set.has(index),
    sortOrder: index,
  }));
}

/**
 * Builds published HSK Demo 1 exam + assignment for a demo student.
 * Idempotent: if a published exam with the demo name already exists, reuses it.
 */
export async function seedAssessmentDemo(
  deps: AssessmentDemoSeedDeps,
): Promise<AssessmentDemoSeedResult> {
  const log = deps.logger ?? new Logger('AssessmentDemoSeed');
  const {
    dataSource,
    banks,
    questions,
    blocks,
    exams,
    assignments,
    students,
    actor,
  } = deps;

  const existingExams = await exams.listForActor(actor);
  const existing = existingExams.find(
    (e) => e.name === ASSESSMENT_DEMO.examName && e.status === ContentLifecycleStatus.Published,
  );

  const student = await ensureDemoStudent(deps);
  const studentPassword = ASSESSMENT_DEMO.studentPassword;
  await ensureDemoCourseEnrollment(deps, student.id);

  if (existing) {
    log.log(`Demo exam "${ASSESSMENT_DEMO.examName}" already published (${existing.id})`);
    const assignment = await ensureAssignment(deps, existing.id, student.id);
    return {
      skipped: true,
      bankId: '',
      blockIds: [],
      examId: existing.id,
      assignmentId: assignment.id,
      studentId: student.id,
      studentEmail: ASSESSMENT_DEMO.studentEmail,
      studentPassword,
      questionIds: [],
    };
  }

  log.log('Creating Assessment demo: Вступительный экзамен HSK 1…');

  const bank = await banks.create({
    name: ASSESSMENT_DEMO.bankName,
    description: 'Учебный банк вопросов для вступительного экзамена HSK 1',
    locale: 'zh-CN',
    createdByUserId: actor.sub,
  });
  await banks.publish(actor, bank.id);

  const listeningIds: string[] = [];
  for (let i = 1; i <= 5; i += 1) {
    const q = await questions.create(actor, {
      bankId: bank.id,
      type: QuestionType.Listening,
      stem: `[Аудирование ${i}] 你听了什么？`,
      points: 1,
      difficulty: 1,
      answers: mcAnswers(0, [`正确 ${i}`, `错误 A`, `错误 B`, `错误 C`]),
      createdByUserId: actor.sub,
    });
    await questions.publish(actor, q.id);
    listeningIds.push(q.id);
  }

  const readingIds: string[] = [];
  for (let i = 1; i <= 3; i += 1) {
    const q = await questions.create(actor, {
      bankId: bank.id,
      type: QuestionType.SingleChoice,
      stem: `[Чтение ${i}] 选择正确的答案`,
      points: 1,
      difficulty: 1,
      answers: mcAnswers(1, [`选项 A`, `正确选项`, `选项 C`, `选项 D`]),
      createdByUserId: actor.sub,
    });
    await questions.publish(actor, q.id);
    readingIds.push(q.id);
  }
  for (let i = 1; i <= 2; i += 1) {
    const q = await questions.create(actor, {
      bankId: bank.id,
      type: QuestionType.MultipleChoice,
      stem: `[Чтение ${i}] Выберите все верные ответы`,
      points: 1,
      difficulty: 2,
      answers: multiAnswers([0, 2], [`Верно 1`, `Неверно`, `Верно 2`, `Неверно`]),
      createdByUserId: actor.sub,
    });
    await questions.publish(actor, q.id);
    readingIds.push(q.id);
  }

  const listeningBlock = await blocks.create(actor, {
    name: ASSESSMENT_DEMO.listeningBlockName,
    description: 'Демо-блок аудирования',
    levelLabel: 'HSK 1',
    durationMinutes: 15,
    questionIds: listeningIds,
    createdByUserId: actor.sub,
  });
  await blocks.publish(actor, listeningBlock.id);

  const readingBlock = await blocks.create(actor, {
    name: ASSESSMENT_DEMO.readingBlockName,
    description: 'Демо-блок чтения',
    levelLabel: 'HSK 1',
    durationMinutes: 15,
    questionIds: readingIds,
    createdByUserId: actor.sub,
  });
  await blocks.publish(actor, readingBlock.id);

  const exam = await exams.create(
    {
      blockIds: [listeningBlock.id, readingBlock.id],
      name: ASSESSMENT_DEMO.examName,
      availableFrom: null,
      availableTo: null,
      createdByUserId: actor.sub,
      rule: {
        durationMinutes: 30,
        maxAttempts: 3,
        allowRetake: true,
        retakePolicy: RetakePolicy.Best,
        allowReview: false,
        showResultAfterSubmit: true,
        showCorrectAnswers: ShowCorrectAnswers.Never,
        autoSubmitOnTimeout: true,
        allowPause: false,
        randomizeQuestions: false,
        randomizeAnswers: false,
        passingMode: PassingMode.Percent,
        passScorePercent: 60,
        allowNavigation: true,
      },
    },
    actor,
  );
  const published = await exams.publish(exam.id, actor);

  const assignment = await ensureAssignment(deps, published.id, student.id);
  const questionIds = [...listeningIds, ...readingIds];

  log.log(
    `Demo ready: exam=${published.id} assignment=${assignment.id} student=${ASSESSMENT_DEMO.studentEmail}`,
  );

  return {
    skipped: false,
    bankId: bank.id,
    blockIds: [listeningBlock.id, readingBlock.id],
    examId: published.id,
    assignmentId: assignment.id,
    studentId: student.id,
    studentEmail: ASSESSMENT_DEMO.studentEmail,
    studentPassword,
    questionIds,
  };
}

async function ensureDemoStudent(deps: AssessmentDemoSeedDeps) {
  const { dataSource, students } = deps;
  const users = dataSource.getRepository(UserEntity);
  const email = ASSESSMENT_DEMO.studentEmail;
  let user = await users.findOne({ where: { email } });

  if (!user) {
    const now = new Date();
    user = await users.save(
      users.create({
        id: randomUUID(),
        email,
        passwordHash: bcrypt.hashSync(ASSESSMENT_DEMO.studentPassword, 10),
        role: 'student',
        status: 'active',
        emailVerified: true,
        verificationCode: null,
        verificationCodeExpiresAt: null,
        verificationCodeSentAt: null,
        verificationAttempts: 0,
        firstName: 'Demo',
        lastName: 'Student',
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
      }),
    );
  }

  const all = await students.findAll(deps.actor);
  let student = all.find((s) => s.userId === user!.id || s.email === email);
  if (!student) {
    student = await students.create({
      name: ASSESSMENT_DEMO.studentName,
      email,
      userId: user.id,
      status: 'active',
    });
  }
  return student;
}

async function ensureDemoCourseEnrollment(
  deps: AssessmentDemoSeedDeps,
  studentId: string,
): Promise<void> {
  const { dataSource } = deps;
  const courses = dataSource.getRepository(CourseTemplateEntity);
  const enrollments = dataSource.getRepository(EnrollmentEntity);

  let course = await courses.findOne({ where: { name: ASSESSMENT_DEMO.courseName } });
  if (!course) {
    course = await courses.save(
      courses.create({
        name: ASSESSMENT_DEMO.courseName,
        courseType: 'basic_beginner',
        totalLessons: 10,
        sortOrder: 0,
        description: 'Курс китайского языка HSK 1 (учебный набор данных)',
        price: 0,
        isActive: true,
      }),
    );
  }

  const existing = await enrollments.findOne({
    where: { studentId, courseTemplateId: course.id },
  });
  if (existing) {
    return;
  }

  await enrollments.save(
    enrollments.create({
      studentId,
      courseTemplateId: course.id,
      courseName: course.name,
      completedLessons: 0,
      missedLessons: 0,
      totalLessons: course.totalLessons,
      status: 'active',
      startDate: new Date().toISOString().slice(0, 10),
      notes: 'Assessment demo enrollment',
    }),
  );
}

async function ensureAssignment(
  deps: AssessmentDemoSeedDeps,
  examId: string,
  studentId: string,
) {
  const existing = await deps.assignments.listByExam(examId);
  const found = existing.find(
    (a) =>
      a.targetType === AssignmentTargetType.Student &&
      a.targetId === studentId &&
      a.status !== 'cancelled',
  );
  if (found) return found;

  return deps.assignments.create(
    {
      examId,
      targetType: AssignmentTargetType.Student,
      targetId: studentId,
      validFrom: null,
      validTo: null,
      assignedByUserId: deps.actor.sub,
    },
    deps.actor,
  );
}
