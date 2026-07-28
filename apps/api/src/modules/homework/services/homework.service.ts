import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { JwtPayload } from '../../auth/auth.service';
import { AssessmentScoringService } from '../../assessment/services/assessment-scoring.service';
import { AssessmentQuestionEntity } from '../../assessment/entities/assessment-question.entity';
import { ContentLifecycleStatus, EvaluationType, QuestionType } from '../../assessment/enums';
import { TeacherEntity } from '../../teachers/entities/teacher.entity';
import { StudentEntity } from '../../students/entities/student.entity';
import {
  AssignHomeworkDto,
  CreateHomeworkDto,
  HomeworkAnswerDto,
  UpdateHomeworkDto,
} from '../dto/homework.dto';
import {
  HomeworkAssignmentStatus,
  HomeworkAttemptStatus,
  HomeworkLifecycleStatus,
} from '../enums';
import {
  HomeworkAnswerSnapshotEntity,
  HomeworkAssignmentEntity,
  HomeworkAttemptAnswerEntity,
  HomeworkAttemptAnswerSelectionEntity,
  HomeworkAttemptEntity,
  HomeworkEntity,
  HomeworkItemEntity,
  HomeworkQuestionSnapshotEntity,
  HomeworkResultEntity,
} from '../entities';
import { HomeworkNotifierService } from './homework-notifier.service';

@Injectable()
export class HomeworkService {
  constructor(
    @InjectRepository(HomeworkEntity)
    private readonly homeworks: Repository<HomeworkEntity>,
    @InjectRepository(HomeworkItemEntity)
    private readonly items: Repository<HomeworkItemEntity>,
    @InjectRepository(HomeworkAssignmentEntity)
    private readonly assignments: Repository<HomeworkAssignmentEntity>,
    @InjectRepository(HomeworkAttemptEntity)
    private readonly attempts: Repository<HomeworkAttemptEntity>,
    @InjectRepository(HomeworkQuestionSnapshotEntity)
    private readonly questionSnapshots: Repository<HomeworkQuestionSnapshotEntity>,
    @InjectRepository(HomeworkAnswerSnapshotEntity)
    private readonly answerSnapshots: Repository<HomeworkAnswerSnapshotEntity>,
    @InjectRepository(HomeworkAttemptAnswerEntity)
    private readonly attemptAnswers: Repository<HomeworkAttemptAnswerEntity>,
    @InjectRepository(HomeworkAttemptAnswerSelectionEntity)
    private readonly selections: Repository<HomeworkAttemptAnswerSelectionEntity>,
    @InjectRepository(HomeworkResultEntity)
    private readonly results: Repository<HomeworkResultEntity>,
    @InjectRepository(AssessmentQuestionEntity)
    private readonly questions: Repository<AssessmentQuestionEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachers: Repository<TeacherEntity>,
    @InjectRepository(StudentEntity)
    private readonly students: Repository<StudentEntity>,
    private readonly scoring: AssessmentScoringService,
    private readonly notifier: HomeworkNotifierService,
  ) {}

  private async resolveTeacherId(user: JwtPayload): Promise<string | null> {
    if (user.role === 'admin') return null;
    const teacher = await this.teachers.findOne({ where: { userId: user.sub } });
    return teacher?.id ?? null;
  }

  private async assertTeacherOrAdmin(user: JwtPayload): Promise<string | null> {
    if (user.role === 'admin') return null;
    if (user.role !== 'teacher') {
      throw new ForbiddenException('Only teachers can manage homework');
    }
    const teacherId = await this.resolveTeacherId(user);
    if (!teacherId) {
      throw new ForbiddenException('Teacher profile not found');
    }
    return teacherId;
  }

  private effectiveAssignmentStatus(
    row: HomeworkAssignmentEntity,
  ): HomeworkAssignmentStatus {
    if (
      (row.status === HomeworkAssignmentStatus.Assigned ||
        row.status === HomeworkAssignmentStatus.InProgress) &&
      row.dueAt &&
      new Date(row.dueAt).getTime() < Date.now()
    ) {
      return HomeworkAssignmentStatus.Overdue;
    }
    return row.status;
  }

  async listForTeacher(user: JwtPayload) {
    const teacherId = await this.assertTeacherOrAdmin(user);
    const where =
      teacherId == null
        ? {}
        : [{ teacherId }, { createdByUserId: user.sub }];
    const rows = await this.homeworks.find({
      where,
      order: { updatedAt: 'DESC' },
      relations: ['items'],
    });
    return rows.map((h) => this.toHomeworkDto(h));
  }

  async getHomework(user: JwtPayload, id: string) {
    const hw = await this.homeworks.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!hw) throw new NotFoundException('Homework not found');
    await this.assertCanViewHomework(user, hw);
    const questionIds = (hw.items ?? []).map((i) => i.questionId);
    const questions =
      questionIds.length > 0
        ? await this.questions.find({
            where: { id: In(questionIds) },
            relations: ['answers', 'attachments'],
          })
        : [];
    const byId = new Map(questions.map((q) => [q.id, q]));
    return {
      ...this.toHomeworkDto(hw),
      items: (hw.items ?? [])
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => ({
          id: item.id,
          question_id: item.questionId,
          section_key: item.sectionKey,
          sort_order: item.sortOrder,
          points: item.points != null ? Number(item.points) : null,
          passage_text: item.passageText,
          question: this.mapQuestion(byId.get(item.questionId)),
        })),
    };
  }

  async create(user: JwtPayload, dto: CreateHomeworkDto) {
    const teacherId = await this.assertTeacherOrAdmin(user);
    const hw = await this.homeworks.save(
      this.homeworks.create({
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        instructions: dto.instructions?.trim() || null,
        activityKind: dto.activity_kind || 'test',
        status: HomeworkLifecycleStatus.Draft,
        teacherId,
        createdByUserId: user.sub,
        passScorePercent:
          dto.pass_score_percent != null ? String(dto.pass_score_percent) : '60',
      }),
    );
    if (dto.items?.length) {
      await this.replaceItems(hw.id, dto.items);
    }
    return this.getHomework(user, hw.id);
  }

  async update(user: JwtPayload, id: string, dto: UpdateHomeworkDto) {
    const hw = await this.requireOwnedHomework(user, id);
    if (dto.title !== undefined) hw.title = dto.title.trim();
    if (dto.description !== undefined) hw.description = dto.description?.trim() || null;
    if (dto.instructions !== undefined) hw.instructions = dto.instructions?.trim() || null;
    if (dto.activity_kind !== undefined) hw.activityKind = dto.activity_kind;
    if (dto.pass_score_percent !== undefined) {
      hw.passScorePercent = String(dto.pass_score_percent);
    }
    await this.homeworks.save(hw);
    if (dto.items) {
      await this.replaceItems(hw.id, dto.items);
    }
    return this.getHomework(user, hw.id);
  }

  async publish(user: JwtPayload, id: string) {
    const hw = await this.requireOwnedHomework(user, id);
    const count = await this.items.count({ where: { homeworkId: id } });
    if (count < 1) {
      throw new BadRequestException('Add at least one question before publishing');
    }
    hw.status = HomeworkLifecycleStatus.Published;
    await this.homeworks.save(hw);
    return this.toHomeworkDto(hw);
  }

  async assign(user: JwtPayload, homeworkId: string, dto: AssignHomeworkDto) {
    const hw = await this.requireOwnedHomework(user, homeworkId);
    if (hw.status !== HomeworkLifecycleStatus.Published) {
      throw new BadRequestException('Publish homework before assigning');
    }
    const students = await this.students.find({ where: { id: In(dto.student_ids) } });
    if (students.length !== dto.student_ids.length) {
      throw new BadRequestException('One or more students not found');
    }
    const dueAt = dto.due_at ? new Date(dto.due_at) : null;
    const created: HomeworkAssignmentEntity[] = [];
    for (const student of students) {
      const existing = await this.assignments.findOne({
        where: { homeworkId, studentId: student.id },
      });
      if (existing) {
        throw new ConflictException(
          `Homework already assigned to student ${student.id}`,
        );
      }
      const row = await this.assignments.save(
        this.assignments.create({
          homeworkId,
          studentId: student.id,
          assignedByUserId: user.sub,
          lessonId: dto.lesson_id ?? null,
          status: HomeworkAssignmentStatus.Assigned,
          dueAt,
          assignedAt: new Date(),
        }),
      );
      created.push(row);
      this.notifier.notifyAssigned(row, hw, student);
    }
    return created.map((a) => this.toAssignmentDto(a, hw));
  }

  async listAssignmentsForTeacher(user: JwtPayload, homeworkId?: string) {
    await this.assertTeacherOrAdmin(user);
    const teacherId = await this.resolveTeacherId(user);
    const qb = this.assignments
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.homework', 'h')
      .orderBy('a.assignedAt', 'DESC');
    if (homeworkId) {
      qb.andWhere('a.homework_id = :homeworkId', { homeworkId });
    }
    if (teacherId) {
      qb.andWhere('(h.teacher_id = :teacherId OR h.created_by_user_id = :uid)', {
        teacherId,
        uid: user.sub,
      });
    }
    const rows = await qb.getMany();
    return rows.map((a) => this.toAssignmentDto(a, a.homework));
  }

  async listMyAssignments(user: JwtPayload) {
    if (user.role !== 'student' && user.role !== 'admin') {
      throw new ForbiddenException('Students only');
    }
    const student = await this.students.findOne({ where: { userId: user.sub } });
    if (!student) {
      if (user.role === 'admin') return [];
      throw new ForbiddenException('Student profile not found');
    }
    const rows = await this.assignments.find({
      where: { studentId: student.id },
      relations: ['homework'],
      order: { assignedAt: 'DESC' },
    });
    const attemptMap = new Map<string, HomeworkAttemptEntity>();
    const attempts = await this.attempts.find({
      where: { studentId: student.id },
      order: { startedAt: 'DESC' },
    });
    for (const at of attempts) {
      if (!attemptMap.has(at.assignmentId)) attemptMap.set(at.assignmentId, at);
    }
    const resultByAttempt = new Map<string, HomeworkResultEntity>();
    const attemptIds = [...attemptMap.values()].map((a) => a.id);
    if (attemptIds.length) {
      const results = await this.results.find({ where: { attemptId: In(attemptIds) } });
      for (const r of results) resultByAttempt.set(r.attemptId, r);
    }
    return rows.map((a) => {
      const attempt = attemptMap.get(a.id) ?? null;
      const result = attempt ? resultByAttempt.get(attempt.id) ?? null : null;
      return {
        ...this.toAssignmentDto(a, a.homework),
        attempt: attempt
          ? {
              id: attempt.id,
              status: attempt.status,
              started_at: attempt.startedAt,
              submitted_at: attempt.submittedAt,
            }
          : null,
        result: result
          ? {
              id: result.id,
              score: Number(result.score),
              max_score: Number(result.maxScore),
              percent: Number(result.percent),
              passed: result.passed,
              status: result.status,
              duration_seconds: result.durationSeconds,
            }
          : null,
      };
    });
  }

  async startAttempt(user: JwtPayload, assignmentId: string) {
    const student = await this.requireStudent(user);
    const assignment = await this.assignments.findOne({
      where: { id: assignmentId },
      relations: ['homework'],
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    if (assignment.studentId !== student.id && user.role !== 'admin') {
      throw new ForbiddenException('Not your assignment');
    }
    const status = this.effectiveAssignmentStatus(assignment);
    if (status === HomeworkAssignmentStatus.Overdue) {
      assignment.status = HomeworkAssignmentStatus.Overdue;
      await this.assignments.save(assignment);
      throw new ConflictException('Assignment is overdue');
    }
    if (
      assignment.status === HomeworkAssignmentStatus.Submitted ||
      assignment.status === HomeworkAssignmentStatus.Reviewed
    ) {
      throw new ConflictException('Assignment already completed');
    }

    const live = await this.attempts.findOne({
      where: {
        assignmentId,
        status: HomeworkAttemptStatus.Started,
      },
    });
    if (live) {
      return this.getAttemptState(user, live.id);
    }

    const hw = assignment.homework!;
    const items = await this.items.find({
      where: { homeworkId: hw.id },
      order: { sortOrder: 'ASC' },
    });
    if (!items.length) {
      throw new BadRequestException('Homework has no questions');
    }

    const attempt = await this.attempts.save(
      this.attempts.create({
        assignmentId,
        homeworkId: hw.id,
        studentId: student.id,
        userId: user.sub,
        status: HomeworkAttemptStatus.Started,
        startedAt: new Date(),
        submittedAt: null,
      }),
    );

    await this.createSnapshots(attempt, items);

    assignment.status = HomeworkAssignmentStatus.InProgress;
    await this.assignments.save(assignment);

    return this.getAttemptState(user, attempt.id);
  }

  async saveAnswers(user: JwtPayload, attemptId: string, answers: HomeworkAnswerDto[]) {
    const attempt = await this.requireMutableAttempt(user, attemptId);
    await this.flushAnswers(attempt.id, answers);
    return { ok: true };
  }

  async submit(user: JwtPayload, attemptId: string, answers?: HomeworkAnswerDto[]) {
    const attempt = await this.requireMutableAttempt(user, attemptId);
    if (answers?.length) {
      await this.flushAnswers(attempt.id, answers);
    }

    const submittedAt = new Date();
    attempt.status = HomeworkAttemptStatus.Submitted;
    attempt.submittedAt = submittedAt;
    await this.attempts.save(attempt);

    const result = await this.scoreAndPersist(attempt);
    const assignment = await this.assignments.findOne({
      where: { id: attempt.assignmentId },
      relations: ['homework'],
    });
    if (assignment) {
      assignment.status = result.requiresManualReview
        ? HomeworkAssignmentStatus.Submitted
        : HomeworkAssignmentStatus.Reviewed;
      await this.assignments.save(assignment);

      const student = await this.students.findOne({ where: { id: attempt.studentId } });
      if (student && assignment.homework) {
        this.notifier.notifySubmitted(assignment, assignment.homework, student, result.result);
        if (!result.requiresManualReview) {
          this.notifier.notifyReviewed(assignment, assignment.homework, student, result.result);
        }
      }
    }

    return this.getAttemptState(user, attempt.id);
  }

  async getAttemptState(user: JwtPayload, attemptId: string) {
    const attempt = await this.attempts.findOne({ where: { id: attemptId } });
    if (!attempt) throw new NotFoundException('Attempt not found');
    await this.assertCanAccessAttempt(user, attempt);

    const qSnaps = await this.questionSnapshots.find({
      where: { attemptId },
      order: { sortOrder: 'ASC' },
      relations: ['answerSnapshots'],
    });
    const answers = await this.attemptAnswers.find({
      where: { attemptId },
      relations: ['selections'],
    });
    const hw = await this.homeworks.findOne({ where: { id: attempt.homeworkId } });
    const result = await this.results.findOne({ where: { attemptId } });

    const hideCorrect = attempt.status !== HomeworkAttemptStatus.Submitted;

    return {
      id: attempt.id,
      assignment_id: attempt.assignmentId,
      homework_id: attempt.homeworkId,
      status: attempt.status,
      started_at: attempt.startedAt,
      submitted_at: attempt.submittedAt,
      instructions: hw?.instructions ?? null,
      title: hw?.title ?? null,
      questions: qSnaps.map((q) => ({
        id: q.id,
        section_key: q.sectionKey,
        type: q.type,
        stem: q.stem,
        points: Number(q.points),
        passage_text: q.passageText,
        sort_order: q.sortOrder,
        attachments: [],
        answers: (q.answerSnapshots ?? [])
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((a) => ({
            id: a.id,
            body: a.body,
            sort_order: a.sortOrder,
            ...(hideCorrect ? {} : { is_correct: a.isCorrect }),
          })),
      })),
      answers: answers.map((a) => ({
        question_snapshot_id: a.questionSnapshotId,
        selected_answer_snapshot_ids: (a.selections ?? []).map((s) => s.answerSnapshotId),
        text: a.textAnswer,
        ...(hideCorrect
          ? {}
          : {
              is_correct: a.isCorrect,
              earned_points: a.earnedPoints != null ? Number(a.earnedPoints) : null,
            }),
      })),
      result: result
        ? {
            id: result.id,
            score: Number(result.score),
            max_score: Number(result.maxScore),
            percent: Number(result.percent),
            passed: result.passed,
            evaluation_type: result.evaluationType,
            status: result.status,
            duration_seconds: result.durationSeconds,
            breakdown: result.breakdownJson ? JSON.parse(result.breakdownJson) : null,
          }
        : null,
    };
  }

  async getResultForTeacher(user: JwtPayload, assignmentId: string) {
    await this.assertTeacherOrAdmin(user);
    const assignment = await this.assignments.findOne({
      where: { id: assignmentId },
      relations: ['homework'],
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    await this.assertCanViewHomework(user, assignment.homework!);

    const attempt = await this.attempts.findOne({
      where: {
        assignmentId,
        status: HomeworkAttemptStatus.Submitted,
      },
      order: { submittedAt: 'DESC' },
    });
    if (!attempt) throw new NotFoundException('No submitted attempt');
    return this.getAttemptState(user, attempt.id);
  }

  // --- internals ---

  private async replaceItems(
    homeworkId: string,
    items: Array<{
      question_id: string;
      section_key?: string;
      sort_order?: number;
      points?: number;
      passage_text?: string;
    }>,
  ) {
    const questionIds = items.map((i) => i.question_id);
    const found = await this.questions.find({ where: { id: In(questionIds) } });
    if (found.length !== questionIds.length) {
      throw new BadRequestException('One or more questions not found');
    }
    for (const q of found) {
      if (q.status === ContentLifecycleStatus.Archived) {
        throw new BadRequestException(`Question ${q.id} is archived`);
      }
    }
    await this.items.delete({ homeworkId });
    await this.items.save(
      items.map((item, idx) =>
        this.items.create({
          homeworkId,
          questionId: item.question_id,
          sectionKey: item.section_key || 'test',
          sortOrder: item.sort_order ?? idx,
          points: item.points != null ? String(item.points) : null,
          passageText: item.passage_text?.trim() || null,
        }),
      ),
    );
  }

  private async createSnapshots(
    attempt: HomeworkAttemptEntity,
    items: HomeworkItemEntity[],
  ) {
    const questionIds = items.map((i) => i.questionId);
    const questions = await this.questions.find({
      where: { id: In(questionIds) },
      relations: ['answers'],
    });
    const byId = new Map(questions.map((q) => [q.id, q]));

    for (const item of items) {
      const q = byId.get(item.questionId);
      if (!q) continue;
      const qSnap = await this.questionSnapshots.save(
        this.questionSnapshots.create({
          attemptId: attempt.id,
          sourceQuestionId: q.id,
          sectionKey: item.sectionKey,
          type: q.type,
          stem: q.stem,
          points: item.points ?? q.points,
          difficulty: q.difficulty,
          explanation: q.explanation,
          passageText: item.passageText,
          sortOrder: item.sortOrder,
        }),
      );
      const opts = (q.answers ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
      for (const ans of opts) {
        await this.answerSnapshots.save(
          this.answerSnapshots.create({
            questionSnapshotId: qSnap.id,
            sourceAnswerId: ans.id,
            body: ans.text,
            isCorrect: ans.isCorrect,
            sortOrder: ans.sortOrder,
          }),
        );
      }
    }
  }

  private async flushAnswers(attemptId: string, answers: HomeworkAnswerDto[]) {
    for (const row of answers) {
      const qSnap = await this.questionSnapshots.findOne({
        where: { id: row.question_snapshot_id, attemptId },
      });
      if (!qSnap) {
        throw new BadRequestException(`Unknown question snapshot ${row.question_snapshot_id}`);
      }
      let answer = await this.attemptAnswers.findOne({
        where: { attemptId, questionSnapshotId: row.question_snapshot_id },
      });
      if (!answer) {
        answer = await this.attemptAnswers.save(
          this.attemptAnswers.create({
            attemptId,
            questionSnapshotId: row.question_snapshot_id,
            textAnswer: row.text ?? null,
          }),
        );
      } else {
        answer.textAnswer = row.text ?? null;
        await this.attemptAnswers.save(answer);
      }
      await this.selections.delete({ attemptAnswerId: answer.id });
      const selected = row.selected_answer_snapshot_ids ?? [];
      if (selected.length) {
        await this.selections.save(
          selected.map((id) =>
            this.selections.create({
              attemptAnswerId: answer!.id,
              answerSnapshotId: id,
            }),
          ),
        );
      }
    }
  }

  private async scoreAndPersist(attempt: HomeworkAttemptEntity) {
    const qSnaps = await this.questionSnapshots.find({
      where: { attemptId: attempt.id },
      order: { sortOrder: 'ASC' },
    });
    const attemptAnswers = await this.attemptAnswers.find({
      where: { attemptId: attempt.id },
      relations: ['selections'],
    });
    const answerSnapshotsByQuestionId = new Map();
    for (const q of qSnaps) {
      if (q.type === QuestionType.ShortText) continue;
      const snaps = await this.answerSnapshots.find({
        where: { questionSnapshotId: q.id },
      });
      answerSnapshotsByQuestionId.set(q.id, snaps);
    }

    const hw = await this.homeworks.findOne({ where: { id: attempt.homeworkId } });
    const scored = this.scoring.scoreFromData({
      questionSnapshots: qSnaps,
      answers: attemptAnswers.map((a) => ({
        id: a.id,
        questionSnapshotId: a.questionSnapshotId,
        textAnswer: a.textAnswer,
        selectedAnswerSnapshotIds: (a.selections ?? []).map((s) => s.answerSnapshotId),
      })),
      answerSnapshotsByQuestionId,
      passingRule: {
        passScorePercent: hw?.passScorePercent != null ? Number(hw.passScorePercent) : 60,
      },
    });

    for (const q of scored.questions) {
      if (!q.attemptAnswerId) continue;
      await this.attemptAnswers.update(q.attemptAnswerId, {
        earnedPoints: String(q.earnedPoints),
        isCorrect: q.isCorrect,
      });
    }

    const durationSeconds =
      attempt.startedAt && attempt.submittedAt
        ? Math.max(
            0,
            Math.round(
              (new Date(attempt.submittedAt).getTime() -
                new Date(attempt.startedAt).getTime()) /
                1000,
            ),
          )
        : null;

    const status = scored.requiresManualReview ? 'pending_review' : 'reviewed';
    let result = await this.results.findOne({ where: { attemptId: attempt.id } });
    const payload = {
      attemptId: attempt.id,
      assignmentId: attempt.assignmentId,
      score: String(scored.score),
      maxScore: String(scored.maxScore),
      percent: String(Math.round(scored.percent * 100) / 100),
      passed: scored.passed,
      evaluationType: scored.evaluationType as EvaluationType,
      status,
      durationSeconds,
      breakdownJson: JSON.stringify({
        questions: scored.questions,
        sections: scored.sections,
      }),
    };
    if (result) {
      Object.assign(result, payload);
      result = await this.results.save(result);
    } else {
      result = await this.results.save(this.results.create(payload));
    }

    return { result, requiresManualReview: scored.requiresManualReview };
  }

  private async requireOwnedHomework(user: JwtPayload, id: string) {
    const hw = await this.homeworks.findOne({ where: { id } });
    if (!hw) throw new NotFoundException('Homework not found');
    await this.assertCanViewHomework(user, hw);
    if (user.role === 'admin') return hw;
    if (hw.createdByUserId !== user.sub && hw.teacherId !== (await this.resolveTeacherId(user))) {
      throw new ForbiddenException('Not your homework');
    }
    return hw;
  }

  private async assertCanViewHomework(user: JwtPayload, hw: HomeworkEntity) {
    if (user.role === 'admin') return;
    if (user.role === 'teacher') {
      const teacherId = await this.resolveTeacherId(user);
      if (hw.createdByUserId === user.sub || (teacherId && hw.teacherId === teacherId)) {
        return;
      }
      throw new ForbiddenException('Not your homework');
    }
    if (user.role === 'student') {
      const student = await this.students.findOne({ where: { userId: user.sub } });
      if (!student) throw new ForbiddenException('Student profile not found');
      const assigned = await this.assignments.findOne({
        where: { homeworkId: hw.id, studentId: student.id },
      });
      if (!assigned) throw new ForbiddenException('Homework not assigned to you');
      return;
    }
    throw new ForbiddenException('Access denied');
  }

  private async requireStudent(user: JwtPayload) {
    if (user.role !== 'student' && user.role !== 'admin') {
      throw new ForbiddenException('Students only');
    }
    const student = await this.students.findOne({ where: { userId: user.sub } });
    if (!student) throw new ForbiddenException('Student profile not found');
    return student;
  }

  private async requireMutableAttempt(user: JwtPayload, attemptId: string) {
    const attempt = await this.attempts.findOne({ where: { id: attemptId } });
    if (!attempt) throw new NotFoundException('Attempt not found');
    await this.assertCanAccessAttempt(user, attempt);
    if (attempt.status !== HomeworkAttemptStatus.Started) {
      throw new ConflictException('Attempt is not editable');
    }
    return attempt;
  }

  private async assertCanAccessAttempt(user: JwtPayload, attempt: HomeworkAttemptEntity) {
    if (user.role === 'admin') return;
    if (user.role === 'student' && attempt.userId === user.sub) return;
    if (user.role === 'teacher') {
      const hw = await this.homeworks.findOne({ where: { id: attempt.homeworkId } });
      if (hw) {
        await this.assertCanViewHomework(user, hw);
        return;
      }
    }
    throw new ForbiddenException('Access denied');
  }

  private toHomeworkDto(h: HomeworkEntity) {
    return {
      id: h.id,
      title: h.title,
      description: h.description,
      instructions: h.instructions,
      status: h.status,
      activity_kind: h.activityKind,
      teacher_id: h.teacherId,
      created_by_user_id: h.createdByUserId,
      pass_score_percent:
        h.passScorePercent != null ? Number(h.passScorePercent) : null,
      item_count: h.items?.length,
      created_at: h.createdAt,
      updated_at: h.updatedAt,
    };
  }

  private toAssignmentDto(a: HomeworkAssignmentEntity, hw?: HomeworkEntity | null) {
    return {
      id: a.id,
      homework_id: a.homeworkId,
      student_id: a.studentId,
      assigned_by_user_id: a.assignedByUserId,
      lesson_id: a.lessonId,
      status: this.effectiveAssignmentStatus(a),
      due_at: a.dueAt,
      assigned_at: a.assignedAt,
      title: hw?.title ?? null,
      instructions: hw?.instructions ?? null,
      activity_kind: hw?.activityKind ?? null,
    };
  }

  private mapQuestion(q?: AssessmentQuestionEntity) {
    if (!q) return null;
    return {
      id: q.id,
      type: q.type,
      stem: q.stem,
      points: Number(q.points),
      status: q.status,
      answers: (q.answers ?? []).map((a) => ({
        id: a.id,
        body: a.text,
        is_correct: a.isCorrect,
        sort_order: a.sortOrder,
      })),
    };
  }
}
