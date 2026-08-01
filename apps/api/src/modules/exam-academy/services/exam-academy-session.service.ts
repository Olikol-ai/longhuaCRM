import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AssessmentAccessService } from '../../../common/access/assessment-access.service';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import {
  AssessmentExamPartEntity,
  AssessmentExamPartPoolItemEntity,
} from '../../assessment/entities';
import {
  AttemptStatus,
  ContentLifecycleStatus,
  PassingMode,
  RetakePolicy,
  ShowCorrectAnswers,
  SubmitReason,
} from '../../assessment/enums';
import {
  AssessmentExamRepository,
  AssessmentAttemptRepository,
} from '../../assessment/repositories';
import { AttemptService } from '../../assessment/services/attempt.service';
import { ResultService } from '../../assessment/services/result.service';
import { TeacherEntity } from '../../teachers/entities/teacher.entity';
import {
  ASSESSMENT_EXAM_SOURCE,
  CONTENT_KIND,
  CONTENT_STATUS,
  SESSION_MODE,
  SESSION_STATUS,
  SHOW_ANSWERS,
} from '../constants';
import {
  ExamAcademyContentItemEntity,
  ExamAcademyFavoriteEntity,
  ExamAcademyLevelEntity,
  ExamAcademyMockBlueprintEntity,
  ExamAcademyProgramVersionEntity,
  ExamAcademyReviewItemEntity,
  ExamAcademySessionAttemptEntity,
  ExamAcademySessionEntity,
  ExamAcademyUserStatsDailyEntity,
} from '../entities';

export type CreateSessionInput = {
  mode: string;
  programVersionId: string;
  levelId: string;
  sectionKey?: string | null;
  questionCount?: number | null;
  randomize?: boolean;
  showCorrectAnswers?: string;
  blueprintId?: string | null;
  title?: string;
};

@Injectable()
export class ExamAcademySessionService {
  constructor(
    @InjectRepository(ExamAcademySessionEntity)
    private readonly sessions: Repository<ExamAcademySessionEntity>,
    @InjectRepository(ExamAcademySessionAttemptEntity)
    private readonly sessionAttempts: Repository<ExamAcademySessionAttemptEntity>,
    @InjectRepository(ExamAcademyContentItemEntity)
    private readonly contentItems: Repository<ExamAcademyContentItemEntity>,
    @InjectRepository(ExamAcademyLevelEntity)
    private readonly levels: Repository<ExamAcademyLevelEntity>,
    @InjectRepository(ExamAcademyProgramVersionEntity)
    private readonly versions: Repository<ExamAcademyProgramVersionEntity>,
    @InjectRepository(ExamAcademyMockBlueprintEntity)
    private readonly blueprints: Repository<ExamAcademyMockBlueprintEntity>,
    @InjectRepository(ExamAcademyFavoriteEntity)
    private readonly favorites: Repository<ExamAcademyFavoriteEntity>,
    @InjectRepository(ExamAcademyReviewItemEntity)
    private readonly reviewItems: Repository<ExamAcademyReviewItemEntity>,
    @InjectRepository(ExamAcademyUserStatsDailyEntity)
    private readonly statsDaily: Repository<ExamAcademyUserStatsDailyEntity>,
    @InjectRepository(AssessmentExamPartEntity)
    private readonly parts: Repository<AssessmentExamPartEntity>,
    @InjectRepository(AssessmentExamPartPoolItemEntity)
    private readonly poolItems: Repository<AssessmentExamPartPoolItemEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachers: Repository<TeacherEntity>,
    private readonly exams: AssessmentExamRepository,
    private readonly attempts: AttemptService,
    private readonly attemptRepo: AssessmentAttemptRepository,
    private readonly results: ResultService,
    private readonly access: AssessmentAccessService,
  ) {}

  async create(actor: DomainAccessActor, input: CreateSessionInput) {
    const version = await this.versions.findOne({ where: { id: input.programVersionId } });
    if (!version) throw new NotFoundException('Version not found');
    const level = await this.levels.findOne({ where: { id: input.levelId } });
    if (!level) throw new NotFoundException('Level not found');
    if (level.versionId !== version.id) {
      throw new BadRequestException('Level does not belong to version');
    }

    const studentId = await this.access.resolveStudentId(actor);
    const mode = input.mode || SESSION_MODE.Practice;
    const show =
      input.showCorrectAnswers ||
      (mode === SESSION_MODE.MockExam || mode === SESSION_MODE.RandomExam
        ? SHOW_ANSWERS.AfterSubmit
        : SHOW_ANSWERS.AfterItem);

    const session = await this.sessions.save({
      mode,
      programVersionId: version.id,
      levelId: level.id,
      sectionKey: input.sectionKey ?? null,
      questionCount: input.questionCount ?? null,
      randomize: input.randomize ?? true,
      showCorrectAnswers: show,
      createdByUserId: actor.sub,
      studentId,
      assignedByUserId: null,
      assessmentExamId: null,
      assessmentAssignmentId: null,
      scoringProfileId: null,
      blueprintId: input.blueprintId ?? null,
      status: SESSION_STATUS.Draft,
      title: input.title || `${level.title} · ${mode}`,
      startedAt: null,
      completedAt: null,
    });

    return session;
  }

  async listMine(actor: DomainAccessActor) {
    return this.sessions.find({
      where: { createdByUserId: actor.sub },
      order: { createdAt: 'DESC' },
      take: 100,
      relations: { level: true, programVersion: true },
    });
  }

  async get(actor: DomainAccessActor, sessionId: string) {
    const session = await this.sessions.findOne({
      where: { id: sessionId },
      relations: { level: true, programVersion: true, attempts: true },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.createdByUserId !== actor.sub && !this.access.isAdmin(actor)) {
      throw new ForbiddenException('Forbidden');
    }
    return session;
  }

  async start(actor: DomainAccessActor, sessionId: string) {
    const session = await this.get(actor, sessionId);
    if (
      session.status === SESSION_STATUS.Completed ||
      session.status === SESSION_STATUS.Cancelled
    ) {
      throw new BadRequestException('Session is already finished');
    }

    if (session.assessmentExamId && session.status === SESSION_STATUS.InProgress) {
      const live = await this.attemptRepo.filter({
        examId: session.assessmentExamId,
        userId: actor.sub,
        status: AttemptStatus.Started,
      });
      if (live[0]) {
        return {
          session,
          attempt: live[0],
        };
      }
    }

    const poolPlan = await this.resolvePool(actor, session);
    if (poolPlan.length === 0) {
      if (session.mode === SESSION_MODE.Favorites) {
        throw new BadRequestException(
          'В избранном пока нет заданий. Отметьте вопросы на экране результата.',
        );
      }
      if (session.mode === SESSION_MODE.ErrorReview) {
        throw new BadRequestException(
          'Очередь ошибок пуста. Пройдите тренировку — неверные ответы появятся здесь.',
        );
      }
      throw new BadRequestException(
        'Банк заданий пуст для выбранного уровня/раздела. Добавьте задания в HSK Academy.',
      );
    }

    const durationMinutes = await this.resolveDurationMinutes(session);
    const exam = await this.exams.save({
      name: `[Academy] ${session.title}`,
      status: ContentLifecycleStatus.Draft,
      createdByUserId: actor.sub,
      source: ASSESSMENT_EXAM_SOURCE.ExamAcademy,
      availableFrom: null,
      availableTo: null,
    });

    await this.exams.saveRule({
      examId: exam.id,
      durationMinutes,
      maxAttempts: 50,
      allowRetake: true,
      retakePolicy: RetakePolicy.Last,
      allowReview: true,
      showResultAfterSubmit: true,
      showCorrectAnswers: this.mapShowAnswers(session.showCorrectAnswers),
      autoSubmitOnTimeout: true,
      allowPause: false,
      randomizeQuestions: session.randomize,
      randomizeAnswers: session.randomize,
      passingMode: PassingMode.Percent,
      passScore: null,
      passScorePercent: '60',
      allowNavigation: true,
    });

    for (const [index, part] of poolPlan.entries()) {
      const savedPart = await this.parts.save(
        this.parts.create({
          examId: exam.id,
          sortOrder: index,
          partKind: part.partKind,
          title: part.title,
          selectCount: part.selectCount,
        }),
      );
      await this.poolItems.save(
        part.pool.map((item) =>
          this.poolItems.create({
            partId: savedPart.id,
            questionId: item.questionId,
            readingTaskId: item.readingTaskId,
            listeningTaskId: item.listeningTaskId,
          }),
        ),
      );
    }

    await this.exams.update(exam.id, { status: ContentLifecycleStatus.Published });

    const { studentId, teacherId } = await this.resolveAttemptParticipants(actor);

    await this.access.assertCanStartAttempt(actor, exam.id, null);

    const attempt = await this.attempts.start({
      examId: exam.id,
      assignmentId: null,
      userId: actor.sub,
      studentId,
      teacherId,
    });

    const attemptNumber =
      (await this.sessionAttempts.count({ where: { sessionId: session.id } })) + 1;
    await this.sessionAttempts.save({
      sessionId: session.id,
      assessmentAttemptId: attempt.id,
      attemptNumber,
    });

    const startedAt = session.startedAt ?? new Date();
    // Use update() — sessions loaded with `attempts` relation would orphan rows on save().
    await this.sessions.update(session.id, {
      assessmentExamId: exam.id,
      status: SESSION_STATUS.InProgress,
      startedAt,
    });
    session.assessmentExamId = exam.id;
    session.status = SESSION_STATUS.InProgress;
    session.startedAt = startedAt;

    return { session, attempt };
  }

  async runtime(actor: DomainAccessActor, sessionId: string) {
    const session = await this.get(actor, sessionId);
    const link = await this.sessionAttempts.findOne({
      where: { sessionId },
      order: { attemptNumber: 'DESC' },
    });
    if (!link) throw new BadRequestException('Session has no attempt yet');
    await this.access.assertCanAccessAttempt(actor, link.assessmentAttemptId);
    const state = await this.attempts.getState(link.assessmentAttemptId, actor);
    const version = await this.versions.findOne({ where: { id: session.programVersionId } });
    const level = await this.levels.findOne({ where: { id: session.levelId } });
    return {
      session,
      attempt: {
        id: state.id,
        examId: state.examId,
        status: state.status,
        startedAt: state.startedAt,
        expiresAt: state.expiresAt,
        attemptNumber: state.attemptNumber,
      },
      sections: state.sections,
      show_correct_answers: session.showCorrectAnswers,
      version_title: version?.title ?? null,
      level_title: level?.title ?? null,
    };
  }

  async saveAnswers(
    actor: DomainAccessActor,
    sessionId: string,
    answers: Array<{
      questionSnapshotId: string;
      textAnswer?: string | null;
      selectedAnswerSnapshotIds?: string[];
      textProvided?: boolean;
      selectionsProvided?: boolean;
    }>,
  ) {
    const link = await this.requireLatestAttempt(actor, sessionId);
    return this.attempts.autosaveAnswers({
      attemptId: link.assessmentAttemptId,
      userId: actor.sub,
      role: actor.role,
      actor,
      answers,
    });
  }

  async submit(actor: DomainAccessActor, sessionId: string) {
    const session = await this.get(actor, sessionId);
    const link = await this.requireLatestAttempt(actor, sessionId);
    const submitted = await this.attempts.submit({
      attemptId: link.assessmentAttemptId,
      submitReason: SubmitReason.Manual,
      actor,
    });

    const completedAt = new Date();
    await this.sessions.update(session.id, {
      status: SESSION_STATUS.Completed,
      completedAt,
    });
    session.status = SESSION_STATUS.Completed;
    session.completedAt = completedAt;

    await this.afterSubmitHooks(
      actor,
      session,
      link.assessmentAttemptId,
      submitted.result.id,
    );

    return {
      session,
      result: submitted.result,
    };
  }

  async getResult(actor: DomainAccessActor, sessionId: string) {
    const session = await this.get(actor, sessionId);
    const link = await this.requireLatestAttempt(actor, sessionId);
    const result = await this.results.getByAttemptForActor(link.assessmentAttemptId, actor);
    const breakdowns = result.breakdowns ?? [];
    const attemptAnswers = await this.attemptRepo.findAttemptAnswersByAttemptId(
      link.assessmentAttemptId,
    );
    const qSnaps = await this.attemptRepo.findQuestionSnapshotsByAttemptId(
      link.assessmentAttemptId,
    );
    const reveal = session.showCorrectAnswers !== SHOW_ANSWERS.Never;
    const items = await Promise.all(
      qSnaps.map(async (q) => {
        const ans = attemptAnswers.find((a) => a.questionSnapshotId === q.id);
        const answerSnaps = await this.attemptRepo.findAnswerSnapshotsByQuestionSnapshotId(q.id);
        const selected = ans
          ? await this.attemptRepo.findSelectedAnswerSnapshotIds(ans.id)
          : [];
        return {
          snapshot_id: q.id,
          stem: q.stem,
          section_key: q.sectionKey,
          explanation: reveal ? q.explanation : null,
          is_correct: ans?.isCorrect ?? null,
          score: ans?.score ?? null,
          points: q.points,
          vocabulary: [...(q.vocabulary ?? [])]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((v) => ({
              word: v.word,
              pinyin: v.pinyin,
              translation: v.translation,
              explanation: v.explanation,
            })),
          answers: answerSnaps.map((a) => ({
            id: a.id,
            text: a.text,
            selected: selected.includes(a.id),
            is_correct: reveal ? a.isCorrect : undefined,
          })),
          source_question_id: q.sourceQuestionId,
        };
      }),
    );

    return {
      session,
      result,
      breakdowns,
      items,
      show_correct_answers: session.showCorrectAnswers,
    };
  }

  /**
   * Students use student profile; teachers use teacher profile.
   * Admin/tutor QA: ensure a lightweight teacher row so Assessment attempts can start.
   */
  private async resolveAttemptParticipants(
    actor: DomainAccessActor,
  ): Promise<{ studentId: string | null; teacherId: string | null }> {
    const studentId = await this.access.resolveStudentId(actor);
    if (studentId) {
      return { studentId, teacherId: null };
    }
    let teacherId = await this.access.resolveTeacherId(actor);
    if (teacherId) {
      return { studentId: null, teacherId };
    }
    if (this.access.isAdmin(actor) || this.access.isTutor(actor) || this.access.isTeacher(actor)) {
      teacherId = await this.ensureAcademyTeacherProfile(actor);
      return { studentId: null, teacherId };
    }
    throw new BadRequestException(
      'Для прохождения HSK Academy нужен профиль ученика или преподавателя',
    );
  }

  private async ensureAcademyTeacherProfile(actor: DomainAccessActor): Promise<string> {
    const existing = await this.teachers.findOne({ where: { userId: actor.sub } });
    if (existing) return existing.id;
    const saved = await this.teachers.save(
      this.teachers.create({
        name: actor.email || `Academy ${actor.sub.slice(0, 8)}`,
        email: actor.email || null,
        userId: actor.sub,
        status: 'active',
        firstName: null,
        lastName: null,
        phone: null,
        hourlyRate: null,
        telegramId: null,
        specializations: 'exam_academy',
        notes: 'Auto-created for HSK Academy attempts',
      }),
    );
    return saved.id;
  }

  private async requireLatestAttempt(actor: DomainAccessActor, sessionId: string) {
    await this.get(actor, sessionId);
    const link = await this.sessionAttempts.findOne({
      where: { sessionId },
      order: { attemptNumber: 'DESC' },
    });
    if (!link) throw new BadRequestException('Session has no attempt');
    return link;
  }

  private mapShowAnswers(value: string): ShowCorrectAnswers {
    if (value === SHOW_ANSWERS.Never) return ShowCorrectAnswers.Never;
    if (value === SHOW_ANSWERS.AfterSubmit) return ShowCorrectAnswers.AfterSubmit;
    return ShowCorrectAnswers.Always;
  }

  private async resolveDurationMinutes(session: ExamAcademySessionEntity): Promise<number> {
    if (session.blueprintId) {
      const bp = await this.blueprints.findOne({ where: { id: session.blueprintId } });
      if (bp?.totalDurationSeconds) {
        return Math.max(1, Math.ceil(bp.totalDurationSeconds / 60));
      }
    }
    if (session.mode === SESSION_MODE.Practice || session.mode === SESSION_MODE.ErrorReview) {
      return 180;
    }
    return 40;
  }

  private async resolvePool(
    actor: DomainAccessActor,
    session: ExamAcademySessionEntity,
  ): Promise<
    Array<{
      partKind: 'test' | 'listening' | 'reading';
      title: string;
      selectCount: number;
      pool: Array<{
        questionId: string | null;
        readingTaskId: string | null;
        listeningTaskId: string | null;
      }>;
    }>
  > {
    let items: ExamAcademyContentItemEntity[] = [];

    if (session.mode === SESSION_MODE.Favorites) {
      const favs = await this.favorites.find({ where: { userId: actor.sub } });
      if (favs.length === 0) return [];
      items = await this.contentItems.find({
        where: {
          status: CONTENT_STATUS.Published,
          contentId: In(favs.map((f) => f.contentId)),
        },
      });
    } else if (session.mode === SESSION_MODE.ErrorReview) {
      const review = await this.reviewItems.find({
        where: { userId: actor.sub, status: 'active' },
      });
      if (review.length === 0) return [];
      items = await this.contentItems.find({
        where: {
          status: CONTENT_STATUS.Published,
          contentId: In(review.map((r) => r.contentId)),
        },
      });
    } else {
      const where: Record<string, unknown> = {
        levelId: session.levelId,
        status: CONTENT_STATUS.Published,
      };
      if (session.sectionKey) where.sectionKey = session.sectionKey;
      items = await this.contentItems.find({ where });
    }

    if (session.randomize) {
      items = [...items].sort(() => Math.random() - 0.5);
    }

    const count = session.questionCount && session.questionCount > 0
      ? session.questionCount
      : items.length;
    items = items.slice(0, Math.max(1, count));

    if (session.blueprintId) {
      const bp = await this.blueprints.findOne({
        where: { id: session.blueprintId },
        relations: { sections: { sectionTemplate: true } },
      });
      if (bp?.sections?.length) {
        const parts: Array<{
          partKind: 'test' | 'listening' | 'reading';
          title: string;
          selectCount: number;
          pool: Array<{
            questionId: string | null;
            readingTaskId: string | null;
            listeningTaskId: string | null;
          }>;
        }> = [];
        for (const section of [...bp.sections].sort((a, b) => a.sortOrder - b.sortOrder)) {
          const key = section.sectionTemplate?.sectionKey;
          const sectionItems = items.filter((i) => i.sectionKey === key);
          const picked = sectionItems.slice(0, section.selectCount);
          if (picked.length === 0) continue;
          parts.push(this.groupAsPart(picked, section.sectionTemplate?.title || key || 'Part'));
        }
        if (parts.length) return parts;
      }
    }

    return items.length ? [this.groupAsPart(items, session.sectionKey || 'Практика')] : [];
  }

  private groupAsPart(
    items: ExamAcademyContentItemEntity[],
    title: string,
  ): {
    partKind: 'test' | 'listening' | 'reading';
    title: string;
    selectCount: number;
    pool: Array<{
      questionId: string | null;
      readingTaskId: string | null;
      listeningTaskId: string | null;
    }>;
  } {
    const listening = items.filter((i) => i.contentKind === CONTENT_KIND.ListeningTask);
    const reading = items.filter((i) => i.contentKind === CONTENT_KIND.ReadingTask);
    const questions = items.filter((i) => i.contentKind === CONTENT_KIND.Question);

    if (listening.length && !reading.length && !questions.length) {
      return {
        partKind: 'listening',
        title,
        selectCount: listening.length,
        pool: listening.map((i) => ({
          questionId: null,
          readingTaskId: null,
          listeningTaskId: i.contentId,
        })),
      };
    }
    if (reading.length && !listening.length && !questions.length) {
      return {
        partKind: 'reading',
        title,
        selectCount: reading.length,
        pool: reading.map((i) => ({
          questionId: null,
          readingTaskId: i.contentId,
          listeningTaskId: null,
        })),
      };
    }
    return {
      partKind: 'test',
      title,
      selectCount: questions.length || items.length,
      pool: (questions.length ? questions : items).map((i) => ({
        questionId: i.contentKind === CONTENT_KIND.Question ? i.contentId : null,
        readingTaskId: i.contentKind === CONTENT_KIND.ReadingTask ? i.contentId : null,
        listeningTaskId: i.contentKind === CONTENT_KIND.ListeningTask ? i.contentId : null,
      })),
    };
  }

  private async afterSubmitHooks(
    actor: DomainAccessActor,
    session: ExamAcademySessionEntity,
    attemptId: string,
    _resultId: string,
  ): Promise<void> {
    try {
      const result = await this.results.findByAttemptId(attemptId);
      if (!result) return;
      const percent = Number(result.percent) || 0;
      const day = new Date().toISOString().slice(0, 10);
      let stats = await this.statsDaily.findOne({
        where: {
          userId: actor.sub,
          day,
          programVersionId: session.programVersionId,
          levelId: session.levelId,
        },
      });
      if (!stats) {
        stats = this.statsDaily.create({
          userId: actor.sub,
          day,
          programVersionId: session.programVersionId,
          levelId: session.levelId,
          practiceCount: 0,
          mockCount: 0,
          avgPercent: '0',
          bestPercent: '0',
          totalDurationSeconds: 0,
          errorCount: 0,
        });
      }
      const isMock =
        session.mode === SESSION_MODE.MockExam || session.mode === SESSION_MODE.RandomExam;
      if (isMock) stats.mockCount += 1;
      else stats.practiceCount += 1;
      const prevBest = Number(stats.bestPercent) || 0;
      stats.bestPercent = String(Math.max(prevBest, percent));
      const totalSessions = stats.practiceCount + stats.mockCount;
      const prevAvg = Number(stats.avgPercent) || 0;
      stats.avgPercent = String(
        Math.round(((prevAvg * (totalSessions - 1) + percent) / totalSessions) * 100) / 100,
      );
      stats.totalDurationSeconds += result.duration || 0;

      const attemptAnswers = await this.attemptRepo.findAttemptAnswersByAttemptId(attemptId);
      const qSnaps = await this.attemptRepo.findQuestionSnapshotsByAttemptId(attemptId);
      let errors = 0;
      for (const ans of attemptAnswers) {
        if (ans.isCorrect === false) {
          errors += 1;
          const snap = qSnaps.find((q) => q.id === ans.questionSnapshotId);
          const contentId = snap?.sourceQuestionId;
          if (!contentId) continue;
          const contentItem = await this.contentItems.findOne({
            where: {
              contentId,
              contentKind: CONTENT_KIND.Question,
            },
          });
          const existing = await this.reviewItems.findOne({
            where: {
              userId: actor.sub,
              contentKind: CONTENT_KIND.Question,
              contentId,
            },
          });
          if (existing) {
            existing.wrongCount += 1;
            existing.lastWrongAt = new Date();
            existing.status = 'active';
            existing.masteredAt = null;
            existing.sourceAttemptId = attemptId;
            existing.contentItemId = contentItem?.id ?? existing.contentItemId;
            await this.reviewItems.save(existing);
          } else {
            await this.reviewItems.save({
              userId: actor.sub,
              contentKind: CONTENT_KIND.Question,
              contentId,
              contentItemId: contentItem?.id ?? null,
              sourceAttemptId: attemptId,
              wrongCount: 1,
              lastWrongAt: new Date(),
              nextReviewAt: new Date(),
              masteredAt: null,
              status: 'active',
            });
          }
        }
      }
      stats.errorCount += errors;
      await this.statsDaily.save(stats);
    } catch {
      // analytics must not break submit
    }
  }
}
