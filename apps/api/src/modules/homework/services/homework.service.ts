import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { JwtPayload } from '../../auth/auth.service';
import { EvaluationType, QuestionType } from '../../assessment/enums';
import { AssessmentScoringService } from '../../assessment/services/assessment-scoring.service';
import { TutorStudentAccessService } from '../../../common/access/tutor-student-access.service';
import { StudentEntity } from '../../students/entities/student.entity';
import { TeacherEntity } from '../../teachers/entities/teacher.entity';
import { TutorEntity } from '../../tutors/entities/tutor.entity';
import { TutorStudentEntity } from '../../tutors/entities/tutor-student.entity';
import {
  AssignHomeworkDto,
  CreateHomeworkDto,
  HomeworkAnswerDto,
  HomeworkItemDto,
  UpdateHomeworkDto,
  UpdateLocalHomeworkStatusDto,
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
  HomeworkItemAnswerEntity,
  HomeworkItemEntity,
  HomeworkQuestionSnapshotEntity,
  HomeworkResultEntity,
} from '../entities';
import { HomeworkNotifierService } from './homework-notifier.service';

type HomeworkOwnerType = 'teacher' | 'tutor';
type ManagerRole = 'admin' | 'teacher' | 'tutor';

interface ManagerScope {
  role: ManagerRole;
  teacherId: string | null;
  tutorId: string | null;
}

interface LearnerScope {
  role: 'student' | 'tutor_student' | 'admin';
  student: StudentEntity | null;
  tutorStudent: TutorStudentEntity | null;
}

interface HomeworkOwnerInfo {
  ownerType: HomeworkOwnerType;
  ownerId: string | null;
  ownerName: string | null;
}

interface LearnerInfo {
  learnerType: 'student' | 'tutor_student';
  learnerId: string;
  learnerName: string;
  userId: string | null;
}

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
    @InjectRepository(HomeworkItemAnswerEntity)
    private readonly itemAnswers: Repository<HomeworkItemAnswerEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachers: Repository<TeacherEntity>,
    @InjectRepository(StudentEntity)
    private readonly students: Repository<StudentEntity>,
    @InjectRepository(TutorEntity)
    private readonly tutors: Repository<TutorEntity>,
    @InjectRepository(TutorStudentEntity)
    private readonly tutorStudents: Repository<TutorStudentEntity>,
    private readonly tutorStudentAccess: TutorStudentAccessService,
    private readonly scoring: AssessmentScoringService,
    private readonly notifier: HomeworkNotifierService,
  ) {}

  async listForTeacher(user: JwtPayload) {
    const scope = await this.assertManagerOrAdmin(user);
    const rows = await this.homeworks.find({
      where: this.buildHomeworkOwnerWhere(scope, user),
      order: { updatedAt: 'DESC' },
      relations: ['items'],
    });
    return this.enrichHomeworkDtos(rows);
  }

  async getHomework(user: JwtPayload, id: string) {
    const hw = await this.homeworks.findOne({
      where: { id },
      relations: ['items', 'items.answers'],
    });
    if (!hw) throw new NotFoundException('Homework not found');
    await this.assertCanViewHomework(user, hw);
    const owners = await this.buildHomeworkOwnerInfoMap([hw]);
    return {
      ...this.toHomeworkDto(hw, owners.get(hw.id) ?? null),
      items: (hw.items ?? [])
        .slice()
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((item) => this.mapHomeworkItem(item)),
    };
  }

  async create(user: JwtPayload, dto: CreateHomeworkDto) {
    const scope = await this.assertManagerOrAdmin(user);
    const hw = await this.homeworks.save(
      this.homeworks.create({
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        instructions: dto.instructions?.trim() || null,
        activityKind: dto.activity_kind || 'test',
        status: HomeworkLifecycleStatus.Draft,
        teacherId: scope.role === 'teacher' ? scope.teacherId : null,
        tutorId: scope.role === 'tutor' ? scope.tutorId : null,
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

  async delete(user: JwtPayload, id: string) {
    const hw = await this.requireOwnedHomework(user, id);
    await this.homeworks.delete({ id: hw.id });
    return { ok: true };
  }

  async publish(user: JwtPayload, id: string) {
    const hw = await this.requireOwnedHomework(user, id);
    const count = await this.items.count({ where: { homeworkId: id } });
    if (count < 1) {
      throw new BadRequestException('Add at least one question before publishing');
    }
    hw.status = HomeworkLifecycleStatus.Published;
    await this.homeworks.save(hw);
    const owners = await this.buildHomeworkOwnerInfoMap([hw]);
    return this.toHomeworkDto(hw, owners.get(hw.id) ?? null);
  }

  async assign(user: JwtPayload, homeworkId: string, dto: AssignHomeworkDto) {
    const hw = await this.requireOwnedHomework(user, homeworkId);
    if (hw.status !== HomeworkLifecycleStatus.Published) {
      throw new BadRequestException('Publish homework before assigning');
    }

    const studentIds = dto.student_ids ?? [];
    const tutorStudentIds = dto.tutor_student_ids ?? [];
    if (studentIds.length + tutorStudentIds.length < 1) {
      throw new BadRequestException('Select at least one learner');
    }

    const scope = await this.assertManagerOrAdmin(user);
    if (scope.role === 'teacher' && tutorStudentIds.length > 0) {
      throw new ForbiddenException('Teacher cannot assign homework to tutor students');
    }
    if (scope.role === 'tutor' && studentIds.length > 0) {
      throw new ForbiddenException('Tutor cannot assign homework to school students');
    }

    const dueAt = dto.due_at ? new Date(dto.due_at) : null;
    const created: HomeworkAssignmentEntity[] = [];

    if (studentIds.length > 0) {
      const students = await this.students.find({ where: { id: In(studentIds) } });
      if (students.length !== studentIds.length) {
        throw new BadRequestException('One or more students not found');
      }
      if (scope.teacherId) {
        const foreign = students.filter((student) => student.assignedTeacherId !== scope.teacherId);
        if (foreign.length > 0) {
          throw new ForbiddenException('Можно назначать ДЗ только своим ученикам');
        }
      }
      for (const student of students) {
        const existing = await this.assignments.findOne({
          where: { homeworkId, studentId: student.id },
        });
        if (existing) {
          throw new ConflictException(`Homework already assigned to student ${student.id}`);
        }
        const row = await this.assignments.save(
          this.assignments.create({
            homeworkId,
            studentId: student.id,
            tutorStudentId: null,
            assignedByUserId: user.sub,
            lessonId: dto.lesson_id ?? null,
            status: HomeworkAssignmentStatus.Assigned,
            dueAt,
            assignedAt: new Date(),
            manualStatus: null,
            reviewResult: null,
            ownerComment: null,
            manualCheckedAt: null,
            returnedForRevisionAt: null,
          }),
        );
        created.push(row);
        this.notifier.notifyAssigned(row, hw, {
          userId: student.userId ?? null,
          displayName: this.studentDisplayName(student),
        });
      }
    }

    if (tutorStudentIds.length > 0) {
      const tutorStudents = await this.tutorStudents.find({
        where: { id: In(tutorStudentIds) },
      });
      if (tutorStudents.length !== tutorStudentIds.length) {
        throw new BadRequestException('One or more tutor students not found');
      }
      if (scope.tutorId) {
        for (const tutorStudent of tutorStudents) {
          await this.tutorStudentAccess.assertCanWriteTutorStudent(
            user,
            tutorStudent.id,
          );
        }
        const foreign = tutorStudents.filter((student) => student.tutorId !== scope.tutorId);
        if (foreign.length > 0) {
          throw new ForbiddenException('Можно назначать ДЗ только своим ученикам');
        }
      }
      for (const tutorStudent of tutorStudents) {
        const existing = await this.assignments.findOne({
          where: { homeworkId, tutorStudentId: tutorStudent.id },
        });
        if (existing) {
          throw new ConflictException(
            `Homework already assigned to tutor student ${tutorStudent.id}`,
          );
        }
        const row = await this.assignments.save(
          this.assignments.create({
            homeworkId,
            studentId: null,
            tutorStudentId: tutorStudent.id,
            assignedByUserId: user.sub,
            lessonId: dto.lesson_id ?? null,
            status: HomeworkAssignmentStatus.Assigned,
            dueAt,
            assignedAt: new Date(),
            manualStatus: tutorStudent.userId ? null : 'assigned',
            reviewResult: null,
            ownerComment: null,
            manualCheckedAt: null,
            returnedForRevisionAt: null,
          }),
        );
        created.push(row);
        if (tutorStudent.userId) {
          this.notifier.notifyAssigned(row, hw, {
            userId: tutorStudent.userId,
            displayName: this.tutorStudentDisplayName(tutorStudent),
          });
        }
      }
    }

    return this.enrichAssignmentDtos(created, hw);
  }

  async listAssignmentsForTeacher(user: JwtPayload, homeworkId?: string) {
    const scope = await this.assertManagerOrAdmin(user);
    const qb = this.assignments
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.homework', 'h')
      .orderBy('a.assignedAt', 'DESC');
    if (homeworkId) {
      qb.andWhere('a.homework_id = :homeworkId', { homeworkId });
    }
    if (scope.role === 'teacher' && scope.teacherId) {
      qb.andWhere('(h.teacher_id = :teacherId OR h.created_by_user_id = :uid)', {
        teacherId: scope.teacherId,
        uid: user.sub,
      });
    }
    if (scope.role === 'tutor' && scope.tutorId) {
      qb.andWhere('(h.tutor_id = :tutorId OR h.created_by_user_id = :uid)', {
        tutorId: scope.tutorId,
        uid: user.sub,
      });
    }
    const rows = await qb.getMany();
    return this.enrichAssignmentDtos(
      rows,
      undefined,
      new Map(rows.map((row) => [row.homeworkId, row.homework ?? null])),
    );
  }

  async listMyAssignments(user: JwtPayload) {
    const learner = await this.requireLearner(user);
    if (learner.role === 'admin') {
      return [];
    }

    const where =
      learner.role === 'student'
        ? { studentId: learner.student!.id }
        : { tutorStudentId: learner.tutorStudent!.id };

    const rows = await this.assignments.find({
      where,
      relations: ['homework'],
      order: { assignedAt: 'DESC' },
    });

    const attemptWhere =
      learner.role === 'student'
        ? { studentId: learner.student!.id }
        : { tutorStudentId: learner.tutorStudent!.id };
    const attempts = await this.attempts.find({
      where: attemptWhere,
      order: { startedAt: 'DESC' },
    });
    const attemptMap = new Map<string, HomeworkAttemptEntity>();
    for (const attempt of attempts) {
      if (!attemptMap.has(attempt.assignmentId)) {
        attemptMap.set(attempt.assignmentId, attempt);
      }
    }

    const attemptIds = [...attemptMap.values()].map((attempt) => attempt.id);
    const resultByAttempt = new Map<string, HomeworkResultEntity>();
    if (attemptIds.length > 0) {
      const results = await this.results.find({ where: { attemptId: In(attemptIds) } });
      for (const result of results) {
        if (!result.attemptId) continue;
        resultByAttempt.set(result.attemptId, result);
      }
    }

    const enrichedAssignments = await this.enrichAssignmentDtos(
      rows,
      undefined,
      new Map(rows.map((row) => [row.homeworkId, row.homework ?? null])),
    );
    return enrichedAssignments.map((assignment) => {
      const attempt = attemptMap.get(assignment.id) ?? null;
      const result = attempt ? resultByAttempt.get(attempt.id) ?? null : null;
      return {
        ...assignment,
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
    const learner = await this.requireLearner(user);
    const assignment = await this.assignments.findOne({
      where: { id: assignmentId },
      relations: ['homework'],
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    if (assignment.tutorStudentId && !learner.tutorStudent && learner.role !== 'admin') {
      throw new ForbiddenException('Not your assignment');
    }
    if (assignment.studentId && !learner.student && learner.role !== 'admin') {
      throw new ForbiddenException('Not your assignment');
    }
    if (learner.student && assignment.studentId !== learner.student.id) {
      throw new ForbiddenException('Not your assignment');
    }
    if (learner.tutorStudent && assignment.tutorStudentId !== learner.tutorStudent.id) {
      throw new ForbiddenException('Not your assignment');
    }
    if (assignment.tutorStudentId && !learner.tutorStudent?.userId && learner.role !== 'admin') {
      throw new ForbiddenException('Local tutor students do not use the attempt flow');
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
    if (assignment.status === HomeworkAssignmentStatus.NeedsRevision) {
      assignment.status = HomeworkAssignmentStatus.InProgress;
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
        studentId: learner.student?.id ?? null,
        tutorStudentId: learner.tutorStudent?.id ?? null,
        userId: user.sub,
        status: HomeworkAttemptStatus.Started,
        startedAt: new Date(),
        submittedAt: null,
      }),
    );

    await this.createSnapshots(attempt, items);

    assignment.status = HomeworkAssignmentStatus.InProgress;
    assignment.manualStatus = null;
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

    attempt.status = HomeworkAttemptStatus.Submitted;
    attempt.submittedAt = new Date();
    await this.attempts.save(attempt);

    const scoring = await this.scoreAndPersist(attempt);
    const assignment = await this.assignments.findOne({
      where: { id: attempt.assignmentId },
      relations: ['homework'],
    });
    if (assignment) {
      assignment.status = scoring.requiresManualReview
        ? HomeworkAssignmentStatus.Submitted
        : HomeworkAssignmentStatus.Reviewed;
      assignment.reviewResult = scoring.requiresManualReview ? null : 'Автоматически проверено';
      assignment.manualCheckedAt = scoring.requiresManualReview ? null : new Date();
      await this.assignments.save(assignment);

      if (assignment.homework) {
        if (attempt.studentId) {
          const learner = await this.students.findOne({ where: { id: attempt.studentId } });
          if (learner) {
            this.notifier.notifySubmitted(
              assignment,
              assignment.homework,
              {
                userId: attempt.userId,
                displayName: this.studentDisplayName(learner),
              },
              scoring.result,
            );
            if (!scoring.requiresManualReview) {
              this.notifier.notifyReviewed(
                assignment,
                assignment.homework,
                {
                  userId: learner.userId ?? null,
                  displayName: this.studentDisplayName(learner),
                },
                scoring.result,
              );
            }
          }
        } else if (attempt.tutorStudentId) {
          const learner = await this.tutorStudents.findOne({
            where: { id: attempt.tutorStudentId },
          });
          if (learner) {
            this.notifier.notifySubmitted(
              assignment,
              assignment.homework,
              {
                userId: attempt.userId,
                displayName: this.tutorStudentDisplayName(learner),
              },
              scoring.result,
            );
            if (!scoring.requiresManualReview) {
              this.notifier.notifyReviewed(
                assignment,
                assignment.homework,
                {
                  userId: learner.userId ?? null,
                  displayName: this.tutorStudentDisplayName(learner),
                },
                scoring.result,
              );
            }
          }
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
    const assignment = await this.assignments.findOne({
      where: { id: attempt.assignmentId },
      relations: ['homework'],
    });
    const hw = assignment?.homework ?? (await this.homeworks.findOne({ where: { id: attempt.homeworkId } }));
    const result = await this.results.findOne({ where: { attemptId } });
    const ownerMap = hw ? await this.buildHomeworkOwnerInfoMap([hw]) : new Map();
    const ownerInfo = hw ? ownerMap.get(hw.id) ?? null : null;

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
      owner_type: ownerInfo?.ownerType ?? null,
      owner_id: ownerInfo?.ownerId ?? null,
      owner_name: ownerInfo?.ownerName ?? null,
      owner_comment: assignment?.ownerComment ?? null,
      review_result: assignment?.reviewResult ?? null,
      questions: qSnaps.map((question) => ({
        id: question.id,
        section_key: question.sectionKey,
        type: question.type,
        stem: question.stem,
        points: Number(question.points),
        passage_text: question.passageText,
        sort_order: question.sortOrder,
        attachments: [],
        answers: (question.answerSnapshots ?? [])
          .slice()
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .map((answer) => ({
            id: answer.id,
            body: answer.body,
            sort_order: answer.sortOrder,
            ...(hideCorrect ? {} : { is_correct: answer.isCorrect }),
          })),
      })),
      answers: answers.map((answer) => ({
        question_snapshot_id: answer.questionSnapshotId,
        selected_answer_snapshot_ids: (answer.selections ?? []).map(
          (selection) => selection.answerSnapshotId,
        ),
        text: answer.textAnswer,
        ...(hideCorrect
          ? {}
          : {
              is_correct: answer.isCorrect,
              earned_points: answer.earnedPoints != null ? Number(answer.earnedPoints) : null,
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
    await this.assertManagerOrAdmin(user);
    const assignment = await this.assignments.findOne({
      where: { id: assignmentId },
      relations: ['homework'],
    });
    if (!assignment?.homework) {
      throw new NotFoundException('Assignment not found');
    }
    await this.assertCanViewHomework(user, assignment.homework);

    const attempt = await this.attempts.findOne({
      where: { assignmentId, status: HomeworkAttemptStatus.Submitted },
      order: { submittedAt: 'DESC' },
    });
    if (attempt) {
      return this.getAttemptState(user, attempt.id);
    }

    const enriched = await this.enrichAssignmentDtos([assignment], assignment.homework);
    const detail = enriched[0];

    // Tutor flow for local tutor-students stores result without creating an attempt.
    const localResult = await this.results.findOne({
      where: { assignmentId, attemptId: IsNull() },
    });

    return {
      ...detail,
      submitted_at: null,
      answers: [],
      result: localResult
        ? {
            id: localResult.id,
            score: localResult.score != null ? Number(localResult.score) : null,
            max_score: localResult.maxScore != null ? Number(localResult.maxScore) : null,
            percent: localResult.percent != null ? Number(localResult.percent) : null,
            passed: localResult.passed ?? null,
            evaluation_type: localResult.evaluationType,
            status: localResult.status,
            duration_seconds: localResult.durationSeconds,
            breakdown: localResult.breakdownJson ? JSON.parse(localResult.breakdownJson) : null,
            manual: true,
            review_result: localResult.reviewResult,
            owner_comment: localResult.ownerComment,
            completed_at: localResult.completedAt,
            checked_at: localResult.checkedAt,
          }
        : assignment.manualStatus || assignment.reviewResult
          ? {
              score: null,
              max_score: null,
              percent: null,
              passed: null,
              status: assignment.manualStatus ?? detail.status,
              manual: true,
              review_result: assignment.reviewResult,
              owner_comment: assignment.ownerComment,
            }
          : null,
    };
  }

  async updateLocalAssignmentStatus(
    user: JwtPayload,
    assignmentId: string,
    dto: UpdateLocalHomeworkStatusDto,
  ) {
    await this.assertManagerOrAdmin(user);
    const assignment = await this.assignments.findOne({
      where: { id: assignmentId },
      relations: ['homework'],
    });
    if (!assignment?.homework) {
      throw new NotFoundException('Assignment not found');
    }
    if (!assignment.tutorStudentId) {
      throw new BadRequestException('Local homework status is only available for tutor assignments');
    }
    await this.assertCanViewHomework(user, assignment.homework);
    if (user.role === 'tutor') {
      await this.tutorStudentAccess.assertCanWriteTutorStudent(
        user,
        assignment.tutorStudentId,
      );
    }

    const normalized = String(dto.status || '').trim().toLowerCase();
    const allowed = new Set(['completed', 'not_completed', 'reviewed', 'needs_revision']);
    if (!allowed.has(normalized)) {
      throw new BadRequestException('Unsupported local homework status');
    }

    const resultStatusByNormalized: Record<string, HomeworkAssignmentStatus> = {
      completed: HomeworkAssignmentStatus.Submitted,
      not_completed: HomeworkAssignmentStatus.Assigned,
      reviewed: HomeworkAssignmentStatus.Reviewed,
      needs_revision: HomeworkAssignmentStatus.NeedsRevision,
    };
    const resultStatus = resultStatusByNormalized[normalized];
    const now = new Date();

    assignment.manualStatus = resultStatus;
    assignment.ownerComment = dto.comment?.trim() || null;
    assignment.reviewResult = dto.result?.trim() || null;

    assignment.manualCheckedAt =
      resultStatus === HomeworkAssignmentStatus.Reviewed || resultStatus === HomeworkAssignmentStatus.NeedsRevision
        ? now
        : null;
    assignment.returnedForRevisionAt =
      resultStatus === HomeworkAssignmentStatus.NeedsRevision ? now : null;
    assignment.status = resultStatus;

    // Persist local execution metadata into AssignmentResult, without creating HomeworkAttempt.
    const completedAt = resultStatus !== HomeworkAssignmentStatus.Assigned ? now : null;
    const checkedAt =
      resultStatus === HomeworkAssignmentStatus.Reviewed ||
      resultStatus === HomeworkAssignmentStatus.NeedsRevision
        ? now
        : null;

    const existingLocalResult = await this.results.findOne({
      where: { assignmentId: assignment.id, attemptId: IsNull() },
    });

    const localPayload = {
      attemptId: null,
      assignmentId: assignment.id,
      evaluationType: EvaluationType.Manual,
      status: resultStatus,
      score: null,
      maxScore: null,
      percent: null,
      passed: null,
      durationSeconds: null,
      breakdownJson: null,
      completedAt,
      checkedAt,
      ownerComment: assignment.ownerComment,
      reviewResult: assignment.reviewResult,
    };

    if (existingLocalResult) {
      Object.assign(existingLocalResult, localPayload);
      await this.results.save(existingLocalResult);
    } else {
      await this.results.save(this.results.create(localPayload));
    }

    await this.assignments.save(assignment);

    const enriched = await this.enrichAssignmentDtos([assignment], assignment.homework);
    return enriched[0];
  }

  private async replaceItems(homeworkId: string, items: HomeworkItemDto[]) {
    for (const [index, item] of items.entries()) {
      this.assertInlineItemValid(item, index);
    }
    await this.items.delete({ homeworkId });
    for (const [idx, item] of items.entries()) {
      const saved = await this.items.save(
        this.items.create({
          homeworkId,
          questionId: null,
          type: item.type,
          stem: item.stem.trim(),
          difficulty: item.difficulty ?? 1,
          explanation: item.explanation?.trim() || null,
          sectionKey: item.section_key || this.sectionKeyForType(item.type),
          sortOrder: item.sort_order ?? idx,
          points: item.points != null ? String(item.points) : '1',
          passageText: item.passage_text?.trim() || null,
        }),
      );
      const answers = item.answers ?? [];
      if (answers.length > 0) {
        await this.itemAnswers.save(
          answers.map((answer, answerIdx) =>
            this.itemAnswers.create({
              homeworkItemId: saved.id,
              body: answer.text.trim(),
              isCorrect: Boolean(answer.is_correct),
              sortOrder: answer.sort_order ?? answerIdx,
            }),
          ),
        );
      }
    }
  }

  private assertInlineItemValid(item: HomeworkItemDto, index: number): void {
    if (!item.stem?.trim()) {
      throw new BadRequestException(`Question #${index + 1}: enter the question text`);
    }
    const needsOptions =
      item.type === QuestionType.SingleChoice ||
      item.type === QuestionType.MultipleChoice ||
      item.type === QuestionType.Listening ||
      item.type === QuestionType.Reading;
    if (!needsOptions) {
      return;
    }
    const rows = (item.answers ?? []).filter((answer) => answer.text?.trim());
    if (rows.length < 2) {
      throw new BadRequestException(
        `Question #${index + 1}: add at least two answer options`,
      );
    }
    if (!rows.some((answer) => answer.is_correct)) {
      throw new BadRequestException(
        `Question #${index + 1}: mark at least one correct answer`,
      );
    }
    if (
      item.type === QuestionType.SingleChoice ||
      item.type === QuestionType.Listening ||
      item.type === QuestionType.Reading
    ) {
      const correct = rows.filter((answer) => answer.is_correct);
      if (correct.length !== 1) {
        throw new BadRequestException(
          `Question #${index + 1}: this type requires exactly one correct answer`,
        );
      }
    }
  }

  private sectionKeyForType(type: QuestionType | string): string {
    if (type === QuestionType.Listening) return 'listening';
    if (type === QuestionType.Reading) return 'reading';
    if (type === QuestionType.Translation) return 'writing';
    return 'test';
  }

  private async createSnapshots(attempt: HomeworkAttemptEntity, items: HomeworkItemEntity[]) {
    const withAnswers =
      items.length === 0
        ? []
        : await this.items.find({
            where: { id: In(items.map((item) => item.id)) },
            relations: ['answers'],
            order: { sortOrder: 'ASC' },
          });
    const byId = new Map(withAnswers.map((item) => [item.id, item]));

    for (const item of items) {
      const full = byId.get(item.id) ?? item;
      const questionSnapshot = await this.questionSnapshots.save(
        this.questionSnapshots.create({
          attemptId: attempt.id,
          sourceQuestionId: full.questionId,
          sectionKey: full.sectionKey,
          type: full.type as QuestionType,
          stem: full.stem,
          points: full.points ?? '1',
          difficulty: full.difficulty ?? 1,
          explanation: full.explanation,
          passageText: full.passageText,
          sortOrder: full.sortOrder,
        }),
      );
      const answers = (full.answers ?? [])
        .slice()
        .sort((left, right) => left.sortOrder - right.sortOrder);
      for (const answer of answers) {
        await this.answerSnapshots.save(
          this.answerSnapshots.create({
            questionSnapshotId: questionSnapshot.id,
            sourceAnswerId: null,
            body: answer.body,
            isCorrect: answer.isCorrect,
            sortOrder: answer.sortOrder,
          }),
        );
      }
    }
  }

  private async flushAnswers(attemptId: string, answers: HomeworkAnswerDto[]) {
    for (const row of answers) {
      const questionSnapshot = await this.questionSnapshots.findOne({
        where: { id: row.question_snapshot_id, attemptId },
      });
      if (!questionSnapshot) {
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
      if (selected.length > 0) {
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
    const questionSnapshots = await this.questionSnapshots.find({
      where: { attemptId: attempt.id },
      order: { sortOrder: 'ASC' },
    });
    const attemptAnswers = await this.attemptAnswers.find({
      where: { attemptId: attempt.id },
      relations: ['selections'],
    });
    const answerSnapshotsByQuestionId = new Map<string, HomeworkAnswerSnapshotEntity[]>();
    for (const question of questionSnapshots) {
      if (question.type === QuestionType.ShortText) continue;
      const answers = await this.answerSnapshots.find({
        where: { questionSnapshotId: question.id },
      });
      answerSnapshotsByQuestionId.set(question.id, answers);
    }

    const homework = await this.homeworks.findOne({ where: { id: attempt.homeworkId } });
    const scored = this.scoring.scoreFromData({
      questionSnapshots,
      answers: attemptAnswers.map((answer) => ({
        id: answer.id,
        questionSnapshotId: answer.questionSnapshotId,
        textAnswer: answer.textAnswer,
        selectedAnswerSnapshotIds: (answer.selections ?? []).map(
          (selection) => selection.answerSnapshotId,
        ),
      })),
      answerSnapshotsByQuestionId,
      passingRule: {
        passScorePercent: homework?.passScorePercent != null ? Number(homework.passScorePercent) : 60,
      },
    });

    for (const question of scored.questions) {
      if (!question.attemptAnswerId) continue;
      await this.attemptAnswers.update(question.attemptAnswerId, {
        earnedPoints: String(question.earnedPoints),
        isCorrect: question.isCorrect,
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

  private async resolveTeacherId(user: JwtPayload): Promise<string | null> {
    if (user.role === 'admin') return null;
    const teacher = await this.teachers.findOne({ where: { userId: user.sub } });
    return teacher?.id ?? null;
  }

  private async resolveTutorId(user: JwtPayload): Promise<string | null> {
    if (user.role === 'admin') return null;
    const tutor = await this.tutors.findOne({ where: { userId: user.sub } });
    return tutor?.id ?? null;
  }

  private async assertManagerOrAdmin(user: JwtPayload): Promise<ManagerScope> {
    if (user.role === 'admin') {
      return { role: 'admin', teacherId: null, tutorId: null };
    }
    if (user.role === 'teacher') {
      const teacherId = await this.resolveTeacherId(user);
      if (!teacherId) {
        throw new ForbiddenException('Teacher profile not found');
      }
      return { role: 'teacher', teacherId, tutorId: null };
    }
    if (user.role === 'tutor') {
      const tutorId = await this.resolveTutorId(user);
      if (!tutorId) {
        throw new ForbiddenException('Tutor profile not found');
      }
      return { role: 'tutor', teacherId: null, tutorId };
    }
    throw new ForbiddenException('Only teachers and tutors can manage homework');
  }

  private async requireLearner(user: JwtPayload): Promise<LearnerScope> {
    if (user.role === 'admin') {
      return { role: 'admin', student: null, tutorStudent: null };
    }
    if (user.role === 'student') {
      const student = await this.students.findOne({ where: { userId: user.sub } });
      if (!student) {
        throw new ForbiddenException('Student profile not found');
      }
      return { role: 'student', student, tutorStudent: null };
    }
    if (user.role === 'tutor_student') {
      const tutorStudent = await this.tutorStudents.findOne({ where: { userId: user.sub } });
      if (!tutorStudent) {
        throw new ForbiddenException('Tutor student profile not found');
      }
      return { role: 'tutor_student', student: null, tutorStudent };
    }
    throw new ForbiddenException('Students only');
  }

  private buildHomeworkOwnerWhere(
    scope: ManagerScope,
    user: JwtPayload,
  ): Array<Record<string, unknown>> | Record<string, unknown> {
    if (scope.role === 'admin') {
      return {};
    }
    if (scope.role === 'teacher') {
      return [{ teacherId: scope.teacherId }, { createdByUserId: user.sub, tutorId: null }];
    }
    return [{ tutorId: scope.tutorId }, { createdByUserId: user.sub, teacherId: null }];
  }

  private ownerTypeForHomework(homework: HomeworkEntity): HomeworkOwnerType {
    return homework.tutorId ? 'tutor' : 'teacher';
  }

  private async buildHomeworkOwnerInfoMap(
    homeworks: HomeworkEntity[],
  ): Promise<Map<string, HomeworkOwnerInfo>> {
    const teacherIds = [...new Set(homeworks.map((hw) => hw.teacherId).filter(Boolean))] as string[];
    const tutorIds = [...new Set(homeworks.map((hw) => hw.tutorId).filter(Boolean))] as string[];
    const [teachers, tutors] = await Promise.all([
      teacherIds.length > 0 ? this.teachers.find({ where: { id: In(teacherIds) } }) : [],
      tutorIds.length > 0 ? this.tutors.find({ where: { id: In(tutorIds) } }) : [],
    ]);
    const teacherNames = new Map<string, string | null>();
    for (const teacher of teachers) {
      teacherNames.set(teacher.id, teacher.name?.trim() || null);
    }
    const tutorNames = new Map<string, string | null>();
    for (const tutor of tutors) {
      tutorNames.set(tutor.id, tutor.displayName?.trim() || null);
    }
    const map = new Map<string, HomeworkOwnerInfo>();
    for (const hw of homeworks) {
      const ownerType = this.ownerTypeForHomework(hw);
      const ownerId = ownerType === 'teacher' ? hw.teacherId : hw.tutorId;
      const ownerName: string | null =
        ownerType === 'teacher'
          ? (ownerId ? teacherNames.get(ownerId) ?? null : null)
          : (ownerId ? tutorNames.get(ownerId) ?? null : null);
      map.set(hw.id, { ownerType, ownerId, ownerName });
    }
    return map;
  }

  private async buildLearnerInfoMap(
    assignments: HomeworkAssignmentEntity[],
  ): Promise<Map<string, LearnerInfo>> {
    const studentIds = [...new Set(assignments.map((row) => row.studentId).filter(Boolean))] as string[];
    const tutorStudentIds = [...new Set(assignments.map((row) => row.tutorStudentId).filter(Boolean))] as string[];
    const [students, tutorStudents] = await Promise.all([
      studentIds.length > 0 ? this.students.find({ where: { id: In(studentIds) } }) : [],
      tutorStudentIds.length > 0
        ? this.tutorStudents.find({ where: { id: In(tutorStudentIds) } })
        : [],
    ]);
    const map = new Map<string, LearnerInfo>();
    for (const student of students) {
      map.set(`student:${student.id}`, {
        learnerType: 'student',
        learnerId: student.id,
        learnerName: this.studentDisplayName(student),
        userId: student.userId ?? null,
      });
    }
    for (const tutorStudent of tutorStudents) {
      map.set(`tutor_student:${tutorStudent.id}`, {
        learnerType: 'tutor_student',
        learnerId: tutorStudent.id,
        learnerName: this.tutorStudentDisplayName(tutorStudent),
        userId: tutorStudent.userId ?? null,
      });
    }
    return map;
  }

  private learnerMapKey(
    assignment: Pick<HomeworkAssignmentEntity, 'studentId' | 'tutorStudentId'>,
  ): string | null {
    if (assignment.studentId) return `student:${assignment.studentId}`;
    if (assignment.tutorStudentId) return `tutor_student:${assignment.tutorStudentId}`;
    return null;
  }

  private async enrichHomeworkDtos(homeworks: HomeworkEntity[]) {
    const owners = await this.buildHomeworkOwnerInfoMap(homeworks);
    return homeworks.map((hw) => this.toHomeworkDto(hw, owners.get(hw.id) ?? null));
  }

  private async enrichAssignmentDtos(
    assignments: HomeworkAssignmentEntity[],
    homework?: HomeworkEntity | null,
    homeworkMap?: Map<string, HomeworkEntity | null>,
  ) {
    const homeworks =
      homework
        ? [homework]
        : assignments
            .map((assignment) => homeworkMap?.get(assignment.homeworkId) ?? assignment.homework ?? null)
            .filter(Boolean) as HomeworkEntity[];
    const owners = await this.buildHomeworkOwnerInfoMap(homeworks);
    const learners = await this.buildLearnerInfoMap(assignments);
    return assignments.map((assignment) => {
      const hw =
        homework ??
        homeworkMap?.get(assignment.homeworkId) ??
        assignment.homework ??
        null;
      const ownerInfo = hw ? owners.get(hw.id) ?? null : null;
      const learnerKey = this.learnerMapKey(assignment);
      const learnerInfo = learnerKey ? learners.get(learnerKey) ?? null : null;
      return this.toAssignmentDto(assignment, hw, ownerInfo, learnerInfo);
    });
  }

  private studentDisplayName(student: StudentEntity): string {
    return (
      String(student.name ?? '').trim() ||
      [student.lastName, student.firstName].filter(Boolean).join(' ').trim() ||
      student.email ||
      'Ученик'
    );
  }

  private tutorStudentDisplayName(student: TutorStudentEntity): string {
    return (
      String(student.name ?? '').trim() ||
      [student.lastName, student.firstName].filter(Boolean).join(' ').trim() ||
      student.email ||
      'Ученик репетитора'
    );
  }

  private async requireOwnedHomework(user: JwtPayload, id: string) {
    const hw = await this.homeworks.findOne({ where: { id } });
    if (!hw) throw new NotFoundException('Homework not found');
    if (user.role === 'admin') return hw;
    await this.assertCanViewHomework(user, hw);
    const scope = await this.assertManagerOrAdmin(user);
    if (
      scope.role === 'teacher' &&
      hw.createdByUserId !== user.sub &&
      hw.teacherId !== scope.teacherId
    ) {
      throw new ForbiddenException('Not your homework');
    }
    if (
      scope.role === 'tutor' &&
      hw.createdByUserId !== user.sub &&
      hw.tutorId !== scope.tutorId
    ) {
      throw new ForbiddenException('Not your homework');
    }
    return hw;
  }

  private async assertCanViewHomework(user: JwtPayload, hw: HomeworkEntity) {
    if (user.role === 'admin') return;
    if (user.role === 'teacher') {
      const teacherId = await this.resolveTeacherId(user);
      if (
        this.ownerTypeForHomework(hw) === 'teacher' &&
        (hw.createdByUserId === user.sub || (teacherId && hw.teacherId === teacherId))
      ) {
        return;
      }
      throw new ForbiddenException('Not your homework');
    }
    if (user.role === 'tutor') {
      const tutorId = await this.resolveTutorId(user);
      if (
        this.ownerTypeForHomework(hw) === 'tutor' &&
        (hw.createdByUserId === user.sub || (tutorId && hw.tutorId === tutorId))
      ) {
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
    if (user.role === 'tutor_student') {
      const tutorStudent = await this.tutorStudents.findOne({ where: { userId: user.sub } });
      if (!tutorStudent) {
        throw new ForbiddenException('Tutor student profile not found');
      }
      const assigned = await this.assignments.findOne({
        where: { homeworkId: hw.id, tutorStudentId: tutorStudent.id },
      });
      if (!assigned) throw new ForbiddenException('Homework not assigned to you');
      return;
    }
    throw new ForbiddenException('Access denied');
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
    if (
      (user.role === 'student' || user.role === 'tutor_student') &&
      attempt.userId === user.sub
    ) {
      return;
    }
    if (user.role === 'teacher' || user.role === 'tutor') {
      const hw = await this.homeworks.findOne({ where: { id: attempt.homeworkId } });
      if (hw) {
        await this.assertCanViewHomework(user, hw);
        return;
      }
    }
    throw new ForbiddenException('Access denied');
  }

  private effectiveAssignmentStatus(row: HomeworkAssignmentEntity): HomeworkAssignmentStatus {
    if (row.status === HomeworkAssignmentStatus.NeedsRevision) {
      return HomeworkAssignmentStatus.NeedsRevision;
    }
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

  private toHomeworkDto(hw: HomeworkEntity, ownerInfo: HomeworkOwnerInfo | null) {
    return {
      id: hw.id,
      title: hw.title,
      description: hw.description,
      instructions: hw.instructions,
      status: hw.status,
      activity_kind: hw.activityKind,
      teacher_id: hw.teacherId,
      tutor_id: hw.tutorId,
      owner_type: ownerInfo?.ownerType ?? this.ownerTypeForHomework(hw),
      owner_id: ownerInfo?.ownerId ?? null,
      owner_name: ownerInfo?.ownerName ?? null,
      created_by_user_id: hw.createdByUserId,
      pass_score_percent: hw.passScorePercent != null ? Number(hw.passScorePercent) : null,
      item_count: hw.items?.length,
      created_at: hw.createdAt,
      updated_at: hw.updatedAt,
    };
  }

  private toAssignmentDto(
    assignment: HomeworkAssignmentEntity,
    hw?: HomeworkEntity | null,
    ownerInfo?: HomeworkOwnerInfo | null,
    learnerInfo?: LearnerInfo | null,
  ) {
    return {
      id: assignment.id,
      homework_id: assignment.homeworkId,
      student_id: assignment.studentId,
      tutor_student_id: assignment.tutorStudentId,
      learner_type: learnerInfo?.learnerType ?? (assignment.tutorStudentId ? 'tutor_student' : 'student'),
      learner_name: learnerInfo?.learnerName ?? null,
      learner_has_account: learnerInfo?.userId != null,
      assigned_by_user_id: assignment.assignedByUserId,
      lesson_id: assignment.lessonId,
      status: this.effectiveAssignmentStatus(assignment),
      manual_status: assignment.manualStatus,
      review_result: assignment.reviewResult,
      owner_comment: assignment.ownerComment,
      manual_checked_at: assignment.manualCheckedAt,
      returned_for_revision_at: assignment.returnedForRevisionAt,
      due_at: assignment.dueAt,
      assigned_at: assignment.assignedAt,
      title: hw?.title ?? null,
      instructions: hw?.instructions ?? null,
      activity_kind: hw?.activityKind ?? null,
      owner_type: ownerInfo?.ownerType ?? (hw ? this.ownerTypeForHomework(hw) : null),
      owner_id: ownerInfo?.ownerId ?? null,
      owner_name: ownerInfo?.ownerName ?? null,
    };
  }

  private mapHomeworkItem(item: HomeworkItemEntity) {
    return {
      id: item.id,
      type: item.type,
      stem: item.stem,
      points: item.points != null ? Number(item.points) : 1,
      difficulty: item.difficulty ?? 1,
      explanation: item.explanation,
      section_key: item.sectionKey,
      sort_order: item.sortOrder,
      passage_text: item.passageText,
      answers: (item.answers ?? [])
        .slice()
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((answer) => ({
          id: answer.id,
          text: answer.body,
          body: answer.body,
          is_correct: answer.isCorrect,
          sort_order: answer.sortOrder,
        })),
    };
  }
}
