import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssessmentAccessService } from '../../../common/access/assessment-access.service';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import {
  AssessmentAnswerSnapshotEntity,
  AssessmentAttemptEntity,
  AssessmentExamEntity,
  AssessmentListeningQuestionEntity,
  AssessmentQuestionSnapshotEntity,
  AssessmentResultEntity,
} from '../entities';
import {
  AssignmentStatus,
  AttemptStatus,
  QuestionType,
  SubmitReason,
} from '../enums';
import {
  AssessmentAssignmentRepository,
  AssessmentAttemptRepository,
  AssessmentExamRepository,
  AssessmentQuestionRepository,
} from '../repositories';
import { AssessmentContentGuard } from './assessment-content.guard';
import { AssessmentParticipantResolver } from './assessment-participant-resolver.service';
import { ResultService } from './result.service';

export type StartAttemptInput = {
  examId: string;
  assignmentId?: string | null;
  userId: string;
  studentId?: string | null;
  teacherId?: string | null;
};

export type AnswerFlushRow = {
  questionSnapshotId: string;
  textAnswer?: string | null;
  selectedAnswerSnapshotIds?: string[];
  /** When true, textAnswer was explicitly provided (including null/empty). */
  textProvided?: boolean;
  /** When true, selectedAnswerSnapshotIds was explicitly provided (including []). */
  selectionsProvided?: boolean;
};

export type SubmitAttemptInput = {
  attemptId: string;
  submitReason: SubmitReason;
  /** Required for participant submit; omitted for system timeout job. */
  actor?: DomainAccessActor;
  /** Optional final answer flush before scoring — selections by questionSnapshotId. */
  answers?: AnswerFlushRow[];
};

export type AutosaveAnswersInput = {
  attemptId: string;
  userId: string;
  role: string;
  actor?: DomainAccessActor;
  answers: AnswerFlushRow[];
};

export type AutosaveAnswersResult = {
  savedAt: Date;
  count: number;
};

export type AttemptSnapshotsPayload = {
  questionSnapshots: Array<{
    id: string;
    attemptId: string;
    sectionKey: string;
    type: QuestionType;
    stem: string;
    points: string;
    difficulty: number;
    explanation: string | null;
    sortOrder: number;
    sourceQuestionId: string | null;
  }>;
  answerSnapshots: Array<{
    id: string;
    questionSnapshotId: string;
    text: string;
    sortOrder: number;
    sourceAnswerId: string | null;
    /** Omitted for students — authoring / admin only. */
    isCorrect?: boolean;
  }>;
};

export type ListAttemptsFilter = {
  examId?: string;
  studentId?: string;
  status?: AttemptStatus;
  userId?: string;
};

export type AttemptStateSection = {
  sectionKey: string;
  title: string;
  weight: string;
  questions: Array<{
    snapshotId: string;
    type: QuestionType;
    stem: string;
    points: string;
    attachments: Array<{ id: string; kind: string; url: string | null }>;
    answers: Array<{ snapshotId: string; text: string; sortOrder: number }>;
    savedAnswer: {
      selectedAnswerSnapshotIds: string[];
      text: string | null;
    };
  }>;
};

export type AttemptState = {
  id: string;
  examId: string;
  status: AttemptStatus;
  submitReason: SubmitReason | null;
  attemptNumber: number;
  startedAt: Date | null;
  expiresAt: Date | null;
  sections: AttemptStateSection[];
};

@Injectable()
export class AttemptService {
  constructor(
    private readonly attempts: AssessmentAttemptRepository,
    private readonly exams: AssessmentExamRepository,
    private readonly assignments: AssessmentAssignmentRepository,
    private readonly questions: AssessmentQuestionRepository,
    private readonly results: ResultService,
    private readonly guard: AssessmentContentGuard,
    private readonly participants: AssessmentParticipantResolver,
    private readonly access: AssessmentAccessService,
    @InjectRepository(AssessmentListeningQuestionEntity)
    private readonly listeningQuestions: Repository<AssessmentListeningQuestionEntity>,
  ) {}

  findById(id: string): Promise<AssessmentAttemptEntity | null> {
    return this.attempts.findById(id);
  }

  async startForUser(
    user: DomainAccessActor,
    input: { examId: string; assignmentId?: string | null },
  ): Promise<AssessmentAttemptEntity> {
    await this.access.assertCanStartAttempt(user, input.examId, input.assignmentId);
    const { studentId, teacherId } = await this.participants.resolveParticipantIds(user);
    return this.start({
      examId: input.examId,
      assignmentId: input.assignmentId ?? null,
      userId: user.sub,
      studentId,
      teacherId,
    });
  }

  async listFiltered(
    filter: ListAttemptsFilter = {},
    actor?: DomainAccessActor,
  ): Promise<AssessmentAttemptEntity[]> {
    let items = filter.examId
      ? await this.attempts.filterByExamId(filter.examId)
      : await this.attempts.findAll();

    if (filter.userId) {
      items = items.filter((a) => a.userId === filter.userId);
    }
    if (filter.studentId) {
      items = items.filter((a) => a.studentId === filter.studentId);
    }
    if (filter.status) {
      items = items.filter((a) => a.status === filter.status);
    }
    if (actor) {
      items = await this.access.filterReadableAttempts(actor, items);
    }
    return items;
  }

  async getState(attemptId: string, actor: DomainAccessActor): Promise<AttemptState> {
    await this.access.assertCanAccessAttempt(actor, attemptId);
    const attempt = this.guard.requireFound(await this.attempts.findById(attemptId), 'Attempt');
    const exam = this.guard.requireFound(
      await this.exams.findWithStructure(attempt.examId),
      'Exam',
    );
    const qSnaps = await this.attempts.findQuestionSnapshotsByAttemptId(attemptId);
    const attemptAnswers = await this.attempts.findAttemptAnswersByAttemptId(attemptId);
    const answerByQ = new Map(attemptAnswers.map((a) => [a.questionSnapshotId, a]));

    const sectionMeta = new Map(
      (exam.sections ?? []).map((s) => [
        s.sectionKey,
        { title: s.title, weight: String(s.weight) },
      ]),
    );
    const sectionBuckets = new Map<string, AttemptStateSection>();

    for (const qSnap of qSnaps) {
      const meta = sectionMeta.get(qSnap.sectionKey) ?? {
        title: qSnap.sectionKey,
        weight: '0',
      };
      let section = sectionBuckets.get(qSnap.sectionKey);
      if (!section) {
        section = {
          sectionKey: qSnap.sectionKey,
          title: meta.title,
          weight: meta.weight,
          questions: [],
        };
        sectionBuckets.set(qSnap.sectionKey, section);
      }

      const answerSnaps = await this.attempts.findAnswerSnapshotsByQuestionSnapshotId(qSnap.id);
      const attemptAnswer = answerByQ.get(qSnap.id);
      let selectedIds: string[] = [];
      if (attemptAnswer) {
        selectedIds = await this.attempts.findSelectedAnswerSnapshotIds(attemptAnswer.id);
      }

      let attachments: Array<{ id: string; kind: string; url: string | null }> = [];
      if (qSnap.sourceQuestionId) {
        const atts = await this.questions.findAttachmentsByQuestionId(qSnap.sourceQuestionId);
        attachments = atts.map((a) => ({
          id: a.id,
          kind: a.kind,
          url: null,
        }));
        if (attachments.length === 0 && qSnap.sectionKey === 'listening') {
          const lq = await this.listeningQuestions.findOne({
            where: { id: qSnap.sourceQuestionId },
          });
          if (lq) {
            attachments = [
              {
                id: lq.listeningTaskId,
                kind: 'audio',
                url: `/api/assessment/listening-tasks/${lq.listeningTaskId}/audio`,
              },
            ];
          }
        }
      }

      section.questions.push({
        snapshotId: qSnap.id,
        type: qSnap.type,
        stem: qSnap.stem,
        points: String(qSnap.points),
        attachments,
        answers: answerSnaps.map((a) => ({
          snapshotId: a.id,
          text: a.text,
          sortOrder: a.sortOrder,
        })),
        savedAnswer: {
          selectedAnswerSnapshotIds: selectedIds,
          text: attemptAnswer?.textAnswer ?? null,
        },
      });
    }

    return {
      id: attempt.id,
      examId: attempt.examId,
      status: attempt.status,
      submitReason: attempt.submitReason,
      attemptNumber: attempt.attemptNumber,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      sections: [...sectionBuckets.values()],
    };
  }

  /**
   * Autosave answers for a started Attempt owned by the caller.
   */
  async autosaveAnswers(input: AutosaveAnswersInput): Promise<AutosaveAnswersResult> {
    const actor = input.actor ?? { sub: input.userId, role: input.role, email: '' };
    await this.access.assertCanMutateAttempt(actor, input.attemptId);
    const attempt = await this.assertMutable(input.attemptId);
    await this.flushAnswers(attempt.id, input.answers, { validate: true });
    return { savedAt: new Date(), count: input.answers.length };
  }

  /**
   * Return immutable Snapshot set for the Attempt (no live Question/Answer entities).
   */
  async getSnapshots(
    attemptId: string,
    user: DomainAccessActor,
  ): Promise<AttemptSnapshotsPayload> {
    await this.access.assertCanAccessAttempt(user, attemptId);
    const attempt = this.guard.requireFound(await this.attempts.findById(attemptId), 'Attempt');
    this.assertAttemptReadable(attempt, user.sub, user.role);

    const questionSnapshots = await this.attempts.findQuestionSnapshotsByAttemptId(attemptId);
    const answerSnapshots = await this.attempts.findAnswerSnapshotsByAttemptId(attemptId);
    const includeCorrect = this.isAuthoringRole(user.role);

    return {
      questionSnapshots: questionSnapshots.map((q) => this.toQuestionSnapshotDto(q)),
      answerSnapshots: answerSnapshots.map((a) => this.toAnswerSnapshotDto(a, includeCorrect)),
    };
  }

  /**
   * Start attempt: creates Attempt (created→started) and immutable Snapshot set once.
   */
  async start(input: StartAttemptInput): Promise<AssessmentAttemptEntity> {
    if (!input.studentId && !input.teacherId) {
      throw new ConflictException('Attempt requires studentId or teacherId');
    }
    if (input.studentId && input.teacherId) {
      throw new ConflictException('Attempt cannot have both studentId and teacherId');
    }

    const exam = this.guard.requireFound(
      await this.exams.findWithStructure(input.examId),
      'Exam',
    );
    this.guard.assertPublished(exam.status, 'Exam');

    let assignmentId: string | null = input.assignmentId ?? null;
    if (assignmentId) {
      const assignment = this.guard.requireFound(
        await this.assignments.findById(assignmentId),
        'Assignment',
      );
      if (assignment.examId !== exam.id) {
        throw new ConflictException('Assignment does not belong to this Exam');
      }
      if (assignment.status !== AssignmentStatus.Active) {
        throw new ConflictException('Assignment must be active to start an Attempt');
      }
    }

    const live = await this.attempts.countAttemptsForUserExamByStatus(
      input.userId,
      exam.id,
      AttemptStatus.Started,
    );
    if (live > 0) {
      throw new ConflictException('A started Attempt already exists for this Exam');
    }

    const rule = exam.rule ?? (await this.exams.findRuleByExamId(exam.id));
    if (!rule) {
      throw new ConflictException('Exam has no AssessmentRule');
    }

    const priorCount = await this.attempts.countAttemptsForUserExam(input.userId, exam.id);
    if (priorCount >= rule.maxAttempts) {
      throw new ConflictException('Maximum attempts reached');
    }

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + rule.durationMinutes * 60_000);

    const attempt = await this.attempts.save({
      examId: exam.id,
      assignmentId,
      status: AttemptStatus.Started,
      submitReason: null,
      attemptNumber: priorCount + 1,
      studentId: input.studentId ?? null,
      teacherId: input.teacherId ?? null,
      userId: input.userId,
      startedAt,
      expiresAt,
      submittedAt: null,
    });

    const existingSnapshots = await this.attempts.countSnapshots(attempt.id);
    if (existingSnapshots > 0) {
      throw new ConflictException('Snapshot already exists for this Attempt');
    }

    await this.createSnapshots(attempt, exam, rule.randomizeQuestions, rule.randomizeAnswers);

    return this.guard.requireFound(await this.attempts.findById(attempt.id), 'Attempt');
  }

  /**
   * Submit attempt with reason; creates Result. No further answer mutations after this.
   */
  async submit(input: SubmitAttemptInput): Promise<{
    attempt: AssessmentAttemptEntity;
    result: AssessmentResultEntity;
  }> {
    if (input.actor && input.submitReason === SubmitReason.Manual) {
      await this.access.assertCanMutateAttempt(input.actor, input.attemptId);
    }

    const attempt = this.guard.requireFound(
      await this.attempts.findById(input.attemptId),
      'Attempt',
    );
    if (attempt.status === AttemptStatus.Submitted) {
      throw new ConflictException('Attempt is already submitted');
    }
    if (attempt.status !== AttemptStatus.Started) {
      throw new ConflictException('Only a started Attempt can be submitted');
    }

    if (input.answers?.length) {
      await this.flushAnswers(attempt.id, input.answers, { validate: true });
    }

    const submittedAt = new Date();
    const updated = await this.attempts.update(attempt.id, {
      status: AttemptStatus.Submitted,
      submitReason: input.submitReason,
      submittedAt,
    });
    const submitted = this.guard.requireFound(updated, 'Attempt');

    const result = await this.results.createForSubmittedAttempt(submitted);

    return { attempt: submitted, result };
  }

  async assertMutable(attemptId: string): Promise<AssessmentAttemptEntity> {
    const attempt = this.guard.requireFound(await this.attempts.findById(attemptId), 'Attempt');
    if (attempt.status === AttemptStatus.Submitted) {
      throw new ConflictException('Submitted Attempt cannot be modified');
    }
    if (attempt.status !== AttemptStatus.Started) {
      throw new ConflictException('Attempt is not in started state');
    }
    return attempt;
  }

  assertAttemptOwner(
    attempt: AssessmentAttemptEntity,
    userId: string,
    role: string,
  ): void {
    if (this.isAdminRole(role)) {
      return;
    }
    if (attempt.userId !== userId) {
      throw new ForbiddenException('Forbidden: not the Attempt owner');
    }
  }

  assertAttemptReadable(
    attempt: AssessmentAttemptEntity,
    userId: string,
    role: string,
  ): void {
    if (this.isAdminRole(role)) {
      return;
    }
    if (attempt.userId !== userId) {
      throw new ForbiddenException('Forbidden: cannot access this Attempt');
    }
  }

  private async flushAnswers(
    attemptId: string,
    answers: AnswerFlushRow[],
    options?: { validate?: boolean },
  ): Promise<void> {
    const validate = options?.validate ?? false;
    const questionSnapshots = validate
      ? await this.attempts.findQuestionSnapshotsByAttemptId(attemptId)
      : [];
    const qSnapById = new Map(questionSnapshots.map((q) => [q.id, q]));
    const answerSnapsByQuestion = new Map<string, AssessmentAnswerSnapshotEntity[]>();

    if (validate) {
      for (const q of questionSnapshots) {
        answerSnapsByQuestion.set(
          q.id,
          await this.attempts.findAnswerSnapshotsByQuestionSnapshotId(q.id),
        );
      }
    }

    for (const row of answers) {
      if (validate) {
        this.validateAnswerRow(row, qSnapById, answerSnapsByQuestion);
      }

      let attemptAnswer = (await this.attempts.findAttemptAnswersByAttemptId(attemptId)).find(
        (a) => a.questionSnapshotId === row.questionSnapshotId,
      );

      const nextText =
        row.textProvided || row.textAnswer !== undefined
          ? (row.textAnswer ?? null)
          : (attemptAnswer?.textAnswer ?? null);

      if (!attemptAnswer) {
        attemptAnswer = await this.attempts.saveAttemptAnswer({
          attemptId,
          questionSnapshotId: row.questionSnapshotId,
          textAnswer: nextText,
        });
      } else {
        attemptAnswer = await this.attempts.saveAttemptAnswer({
          ...attemptAnswer,
          textAnswer: nextText,
        });
      }

      if (row.selectionsProvided || row.selectedAnswerSnapshotIds !== undefined) {
        await this.attempts.replaceSelectionsForAttemptAnswer(
          attemptAnswer.id,
          row.selectedAnswerSnapshotIds ?? [],
        );
      }
    }
  }

  private validateAnswerRow(
    row: AnswerFlushRow,
    qSnapById: Map<string, AssessmentQuestionSnapshotEntity>,
    answerSnapsByQuestion: Map<string, AssessmentAnswerSnapshotEntity[]>,
  ): void {
    const qSnap = qSnapById.get(row.questionSnapshotId);
    if (!qSnap) {
      throw new BadRequestException(
        'question_snapshot_id does not belong to this Attempt Snapshot',
      );
    }

    const allowedAnswers = answerSnapsByQuestion.get(qSnap.id) ?? [];
    const allowedIds = new Set(allowedAnswers.map((a) => a.id));
    const selected = row.selectedAnswerSnapshotIds ?? [];

    for (const answerId of selected) {
      if (!allowedIds.has(answerId)) {
        throw new BadRequestException(
          'selected answer_snapshot_id does not belong to this question Snapshot',
        );
      }
    }

    switch (qSnap.type) {
      case QuestionType.SingleChoice:
        if (selected.length > 1) {
          throw new BadRequestException('single_choice allows at most one selected answer');
        }
        break;
      case QuestionType.MultipleChoice:
        break;
      case QuestionType.ShortText:
      case QuestionType.Translation:
      case QuestionType.Reading:
        // Legacy reading/translation snapshots: free-text (manual review), no choice selections.
        if (selected.length > 0) {
          throw new BadRequestException(
            `${String(qSnap.type)} does not accept selected answers`,
          );
        }
        break;
      case QuestionType.Listening:
        break;
      default:
        throw new BadRequestException(`Unsupported question type: ${String(qSnap.type)}`);
    }
  }

  private toQuestionSnapshotDto(q: AssessmentQuestionSnapshotEntity) {
    return {
      id: q.id,
      attemptId: q.attemptId,
      sectionKey: q.sectionKey,
      type: q.type,
      stem: q.stem,
      points: String(q.points),
      difficulty: q.difficulty,
      explanation: q.explanation,
      sortOrder: q.sortOrder,
      sourceQuestionId: q.sourceQuestionId,
    };
  }

  private toAnswerSnapshotDto(
    a: AssessmentAnswerSnapshotEntity,
    includeCorrect: boolean,
  ) {
    const base = {
      id: a.id,
      questionSnapshotId: a.questionSnapshotId,
      text: a.text,
      sortOrder: a.sortOrder,
      sourceAnswerId: a.sourceAnswerId,
    };
    if (includeCorrect) {
      return { ...base, isCorrect: a.isCorrect };
    }
    return base;
  }

  private isAdminRole(role: string): boolean {
    return role.trim().toLowerCase() === 'admin';
  }

  private isAuthoringRole(role: string): boolean {
    const normalized = role.trim().toLowerCase();
    return normalized === 'admin' || normalized === 'teacher' || normalized === 'tutor';
  }

  private async createSnapshots(
    attempt: AssessmentAttemptEntity,
    exam: AssessmentExamEntity,
    randomizeQuestions: boolean,
    randomizeAnswers: boolean,
  ): Promise<void> {
    const parts = [...(exam.parts ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    if (parts.length > 0) {
      await this.createSnapshotsFromParts(attempt, exam, parts, randomizeAnswers);
      return;
    }
    await this.createSnapshotsFromExamQuestions(
      attempt,
      exam,
      randomizeQuestions,
      randomizeAnswers,
    );
  }

  private async createSnapshotsFromParts(
    attempt: AssessmentAttemptEntity,
    exam: AssessmentExamEntity,
    parts: NonNullable<AssessmentExamEntity['parts']>,
    randomizeAnswers: boolean,
  ): Promise<void> {
    type QSnap = {
      attemptId: string;
      sourceQuestionId: string;
      sectionKey: string;
      type: QuestionType;
      stem: string;
      points: string;
      difficulty: number;
      explanation: string | null;
      sortOrder: number;
      answers: Array<{
        text: string;
        isCorrect: boolean;
        sortOrder: number;
        sourceAnswerId: string;
      }>;
    };

    const prepared: QSnap[] = [];
    let sortOrder = 0;

    for (const part of parts) {
      const pool = [...(part.poolItems ?? [])];
      if (pool.length === 0) {
        throw new ConflictException(`Exam part «${part.title ?? part.partKind}» has empty pool`);
      }
      const count = Math.min(Math.max(part.selectCount, 1), pool.length);
      this.shuffleInPlace(pool);
      const selected = pool.slice(0, count);
      const sectionKey = part.partKind;

      for (const item of selected) {
        if (part.partKind === 'test') {
          const q = item.question;
          if (!q) {
            throw new ConflictException(`Pool item missing question for part ${part.id}`);
          }
          const answers = [...(q.answers ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
          if (randomizeAnswers) this.shuffleInPlace(answers);
          prepared.push({
            attemptId: attempt.id,
            sourceQuestionId: q.id,
            sectionKey,
            type: q.type,
            stem: q.stem,
            points: String(q.points),
            difficulty: q.difficulty,
            explanation: q.explanation,
            sortOrder: sortOrder++,
            answers: answers.map((a, idx) => ({
              sourceAnswerId: a.id,
              text: a.text,
              isCorrect: a.isCorrect,
              sortOrder: idx,
            })),
          });
          continue;
        }

        const task =
          part.partKind === 'reading'
            ? item.readingTask
            : part.partKind === 'listening'
              ? item.listeningTask
              : null;
        if (!task) {
          throw new ConflictException(
            `Pool item missing ${part.partKind} task for part ${part.id}`,
          );
        }
        const nested = [...(task.questions ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
        if (nested.length === 0) {
          throw new ConflictException(
            `Task «${task.title}» has no questions for part ${part.id}`,
          );
        }
        for (const q of nested) {
          const answers = [...(q.answers ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
          if (randomizeAnswers) this.shuffleInPlace(answers);
          const passagePrefix =
            part.partKind === 'reading' && 'textContent' in task && task.textContent
              ? `${task.textContent}\n\n`
              : '';
          prepared.push({
            attemptId: attempt.id,
            sourceQuestionId: q.id,
            sectionKey,
            type: q.type,
            stem: `${passagePrefix}${q.stem}`,
            points: String(q.points),
            difficulty: 1,
            explanation: q.explanation,
            sortOrder: sortOrder++,
            answers: answers.map((a, idx) => ({
              sourceAnswerId: a.id,
              text: a.text,
              isCorrect: a.isCorrect,
              sortOrder: idx,
            })),
          });
        }
      }
    }

    if (prepared.length === 0) {
      throw new ConflictException('Generated exam attempt has no questions');
    }

    await this.persistPreparedSnapshots(prepared);
  }

  private async createSnapshotsFromExamQuestions(
    attempt: AssessmentAttemptEntity,
    exam: AssessmentExamEntity,
    randomizeQuestions: boolean,
    randomizeAnswers: boolean,
  ): Promise<void> {
    const examQuestions = [...(exam.examQuestions ?? [])].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    const sections = exam.sections ?? [];
    const sectionById = new Map(sections.map((s) => [s.id, s]));

    const questionIds = examQuestions.map((eq) => eq.questionId);
    const loaded = await this.questions.findByIdsWithAnswers(questionIds);
    const byId = new Map(loaded.map((q) => [q.id, q]));

    type QSnap = {
      attemptId: string;
      sourceQuestionId: string;
      sectionKey: string;
      type: QuestionType;
      stem: string;
      points: string;
      difficulty: number;
      explanation: string | null;
      sortOrder: number;
      answers: Array<{
        text: string;
        isCorrect: boolean;
        sortOrder: number;
        sourceAnswerId: string;
      }>;
    };

    const prepared: QSnap[] = [];
    for (let i = 0; i < examQuestions.length; i += 1) {
      const eq = examQuestions[i];
      const q = byId.get(eq.questionId);
      if (!q) {
        throw new ConflictException(`Exam question ${eq.questionId} missing from bank`);
      }
      const section = sectionById.get(eq.sectionId);
      const answers = [...(q.answers ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
      if (randomizeAnswers) {
        this.shuffleInPlace(answers);
      }
      prepared.push({
        attemptId: attempt.id,
        sourceQuestionId: q.id,
        sectionKey: section?.sectionKey ?? 'default',
        type: q.type,
        stem: q.stem,
        points: String(q.points),
        difficulty: q.difficulty,
        explanation: q.explanation,
        sortOrder: i,
        answers: answers.map((a, idx) => ({
          sourceAnswerId: a.id,
          text: a.text,
          isCorrect: a.isCorrect,
          sortOrder: idx,
        })),
      });
    }

    if (randomizeQuestions) {
      this.shuffleInPlace(prepared);
      prepared.forEach((p, idx) => {
        p.sortOrder = idx;
      });
    }

    await this.persistPreparedSnapshots(prepared);
  }

  private async persistPreparedSnapshots(
    prepared: Array<{
      attemptId: string;
      sourceQuestionId: string;
      sectionKey: string;
      type: QuestionType;
      stem: string;
      points: string;
      difficulty: number;
      explanation: string | null;
      sortOrder: number;
      answers: Array<{
        text: string;
        isCorrect: boolean;
        sortOrder: number;
        sourceAnswerId: string;
      }>;
    }>,
  ): Promise<void> {
    const questionSnapshots = prepared.map((p) => ({
      attemptId: p.attemptId,
      sourceQuestionId: p.sourceQuestionId,
      sectionKey: p.sectionKey,
      type: p.type,
      stem: p.stem,
      points: p.points,
      difficulty: p.difficulty,
      explanation: p.explanation,
      sortOrder: p.sortOrder,
    }));

    const saved = await this.attempts.saveSnapshotsInBulk(questionSnapshots, []);
    const qSnapBySource = new Map(
      saved.questionSnapshots.map((s) => [s.sourceQuestionId ?? s.id, s]),
    );

    const answerSnapshots = prepared.flatMap((p) => {
      const qSnap = qSnapBySource.get(p.sourceQuestionId);
      if (!qSnap) {
        throw new ConflictException('Failed to persist question snapshot');
      }
      return p.answers.map((a) => ({
        questionSnapshotId: qSnap.id,
        sourceAnswerId: a.sourceAnswerId,
        text: a.text,
        isCorrect: a.isCorrect,
        sortOrder: a.sortOrder,
      }));
    });

    if (answerSnapshots.length > 0) {
      await this.attempts.saveSnapshotsInBulk([], answerSnapshots);
    }
  }

  private shuffleInPlace<T>(items: T[]): void {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
  }
}
