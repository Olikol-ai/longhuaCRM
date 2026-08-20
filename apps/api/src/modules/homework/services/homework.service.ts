import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createReadStream } from 'fs';
import { In, IsNull, Repository } from 'typeorm';
import { buildContentDisposition } from '../../../common/http/content-disposition';
import { JwtPayload } from '../../auth/auth.service';
import { EvaluationType, QuestionType, isManualReviewQuestionType } from '../../assessment/enums';
import { AssessmentScoringService } from '../../assessment/services/assessment-scoring.service';
import { TutorStudentAccessService } from '../../../common/access/tutor-student-access.service';
import {
  deleteSpeakingAudio,
  resolveSpeakingAudioPath,
  storeSpeakingAudio,
  type SpeakingAudioFile,
} from '../../../common/storage/speaking-audio';
import { StudentEntity } from '../../students/entities/student.entity';
import { TeacherEntity } from '../../teachers/entities/teacher.entity';
import { TutorEntity } from '../../tutors/entities/tutor.entity';
import { TutorStudentEntity } from '../../tutors/entities/tutor-student.entity';
import { UserEntity } from '../../users/entities/user.entity';
import {
  AssignHomeworkDto,
  CreateHomeworkDto,
  HomeworkAnswerDto,
  HomeworkItemDto,
  HomeworkTaskDto,
  SaveHomeworkReviewDto,
  UpdateHomeworkDto,
  UpdateLocalHomeworkStatusDto,
} from '../dto/homework.dto';
import {
  computeAutoHomeworkPercent,
  normalizeHomeworkGradingMode,
  resolveHomeworkPercent,
} from '../homework-grading.util';
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
  HomeworkTaskEntity,
} from '../entities';
import { AssessmentListeningQuestionEntity } from '../../assessment/entities/assessment-listening-question.entity';
import { AssessmentListeningTaskEntity } from '../../assessment/entities/assessment-listening-task.entity';
import { AssessmentQuestionEntity } from '../../assessment/entities/assessment-question.entity';
import { AssessmentReadingQuestionEntity } from '../../assessment/entities/assessment-reading-question.entity';
import { AssessmentReadingTaskEntity } from '../../assessment/entities/assessment-reading-task.entity';
import { HomeworkQuestionSnapshotVocabularyEntity } from '../entities/homework-question-snapshot-vocabulary.entity';
import { HomeworkNotifierService } from './homework-notifier.service';
import { mapVocabularyDto } from '../../assessment/services/task-vocabulary.util';

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
    @InjectRepository(HomeworkTaskEntity)
    private readonly homeworkTasks: Repository<HomeworkTaskEntity>,
    @InjectRepository(AssessmentQuestionEntity)
    private readonly assessmentQuestions: Repository<AssessmentQuestionEntity>,
    @InjectRepository(AssessmentReadingTaskEntity)
    private readonly readingTasks: Repository<AssessmentReadingTaskEntity>,
    @InjectRepository(AssessmentListeningTaskEntity)
    private readonly listeningTasks: Repository<AssessmentListeningTaskEntity>,
    @InjectRepository(AssessmentReadingQuestionEntity)
    private readonly readingQuestions: Repository<AssessmentReadingQuestionEntity>,
    @InjectRepository(AssessmentListeningQuestionEntity)
    private readonly listeningQuestions: Repository<AssessmentListeningQuestionEntity>,
    @InjectRepository(HomeworkQuestionSnapshotVocabularyEntity)
    private readonly snapshotVocabulary: Repository<HomeworkQuestionSnapshotVocabularyEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachers: Repository<TeacherEntity>,
    @InjectRepository(StudentEntity)
    private readonly students: Repository<StudentEntity>,
    @InjectRepository(TutorEntity)
    private readonly tutors: Repository<TutorEntity>,
    @InjectRepository(TutorStudentEntity)
    private readonly tutorStudents: Repository<TutorStudentEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
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
      relations: [
        'items',
        'items.answers',
        'tasks',
        'tasks.question',
        'tasks.readingTask',
        'tasks.listeningTask',
      ],
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
      tasks: (hw.tasks ?? [])
        .slice()
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((task) => ({
          id: task.id,
          task_kind: task.taskKind,
          sort_order: task.sortOrder,
          question_id: task.questionId,
          reading_task_id: task.readingTaskId,
          listening_task_id: task.listeningTaskId,
          points: task.points != null ? Number(task.points) : null,
          question: task.question
            ? { id: task.question.id, type: task.question.type, stem: task.question.stem }
            : null,
          reading_task: task.readingTask
            ? {
                id: task.readingTask.id,
                title: task.readingTask.title,
                status: task.readingTask.status,
              }
            : null,
          listening_task: task.listeningTask
            ? {
                id: task.listeningTask.id,
                title: task.listeningTask.title,
                status: task.listeningTask.status,
              }
            : null,
        })),
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
    if (dto.tasks?.length) {
      await this.replaceTasks(user, hw.id, dto.tasks);
      await this.materializeItemsFromTasks(hw.id);
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
    if (dto.tasks) {
      await this.replaceTasks(user, hw.id, dto.tasks);
      await this.materializeItemsFromTasks(hw.id);
    }
    return this.getHomework(user, hw.id);
  }

  async delete(user: JwtPayload, id: string) {
    const hw = await this.requireOwnedHomework(user, id);
    const assignmentCount = await this.assignments.count({
      where: { homeworkId: hw.id },
    });
    if (assignmentCount > 0) {
      throw new ConflictException(
        'Нельзя удалить домашнее задание: есть назначения ученикам. Сначала снимите назначения или оставьте историю.',
      );
    }
    const attemptCount = await this.attempts.count({
      where: { homeworkId: hw.id },
    });
    if (attemptCount > 0) {
      throw new ConflictException(
        'Нельзя удалить домашнее задание: есть попытки выполнения. История должна сохраняться.',
      );
    }
    await this.homeworks.delete({ id: hw.id });
    return { ok: true };
  }

  async publish(user: JwtPayload, id: string) {
    const hw = await this.requireOwnedHomework(user, id);
    const taskCount = await this.homeworkTasks.count({ where: { homeworkId: id } });
    if (taskCount > 0) {
      await this.materializeItemsFromTasks(id);
    }
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
    if (
      assignment.status === HomeworkAssignmentStatus.Cancelled ||
      status === HomeworkAssignmentStatus.Cancelled
    ) {
      throw new ConflictException('Assignment was cancelled');
    }
    if (status === HomeworkAssignmentStatus.Expired) {
      assignment.status = HomeworkAssignmentStatus.Expired;
      await this.assignments.save(assignment);
      throw new ConflictException('Assignment is overdue');
    }
    if (
      assignment.status === HomeworkAssignmentStatus.Submitted ||
      assignment.status === HomeworkAssignmentStatus.Checked
    ) {
      throw new ConflictException('Assignment already completed');
    }
    if (assignment.status === HomeworkAssignmentStatus.NeedsRevision) {
      assignment.status = HomeworkAssignmentStatus.Started;
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

    const startedAt = new Date();
    const attempt = await this.attempts.save(
      this.attempts.create({
        assignmentId,
        homeworkId: hw.id,
        studentId: learner.student?.id ?? null,
        tutorStudentId: learner.tutorStudent?.id ?? null,
        userId: user.sub,
        status: HomeworkAttemptStatus.Started,
        startedAt,
        submittedAt: null,
      }),
    );

    await this.createSnapshots(attempt, items);

    assignment.status = HomeworkAssignmentStatus.Started;
    assignment.startedAt = assignment.startedAt ?? startedAt;
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
      const now = attempt.submittedAt ?? new Date();
      assignment.submittedAt = now;
      if (!assignment.startedAt) {
        assignment.startedAt = attempt.startedAt ?? now;
      }
      assignment.status = scoring.requiresManualReview
        ? HomeworkAssignmentStatus.Submitted
        : HomeworkAssignmentStatus.Checked;
      assignment.reviewResult = scoring.requiresManualReview ? null : 'Автоматически проверено';
      assignment.manualCheckedAt = scoring.requiresManualReview ? null : now;
      if (!scoring.requiresManualReview) {
        assignment.checkedAt = now;
        assignment.checkedByUserId = null;
      }
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
      relations: ['answerSnapshots', 'vocabulary'],
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

    const isManager =
      user.role === 'admin' || user.role === 'teacher' || user.role === 'tutor';
    const isLearner = user.role === 'student' || user.role === 'tutor_student';
    const reviewed =
      result?.status === 'checked' || result?.status === 'reviewed';
    const showExpectedAnswers =
      isManager || Boolean(reviewed && result?.showCorrectAnswers);
    const showStudentReview =
      isManager || Boolean(reviewed);

    const attachmentsBySource = new Map<string, Array<{ id: string; kind: string; url: string | null }>>();
    const sourceIds = [
      ...new Set(
        qSnaps.map((q) => q.sourceQuestionId).filter((id): id is string => Boolean(id)),
      ),
    ];
    if (sourceIds.length > 0) {
      const sources = await this.assessmentQuestions.find({
        where: { id: In(sourceIds) },
        relations: ['attachments'],
      });
      for (const source of sources) {
        attachmentsBySource.set(
          source.id,
          (source.attachments ?? []).map((att) => ({
            id: att.id,
            kind: att.kind,
            url: `/api/assessment/attachments/${att.id}/download?disposition=inline`,
          })),
        );
      }
      const listeningQs = await this.listeningQuestions.find({
        where: { id: In(sourceIds) },
      });
      for (const lq of listeningQs) {
        if (attachmentsBySource.has(lq.id)) continue;
        attachmentsBySource.set(lq.id, [
          {
            id: lq.listeningTaskId,
            kind: 'audio',
            url: `/api/assessment/listening-tasks/${lq.listeningTaskId}/audio`,
          },
        ]);
      }
    }

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
      student_feedback: assignment?.ownerComment ?? result?.ownerComment ?? null,
      review_result: assignment?.reviewResult ?? null,
      questions: qSnaps.map((question) => ({
        id: question.id,
        snapshot_id: question.id,
        section_key: question.sectionKey,
        type: question.type,
        stem: question.stem,
        points: Number(question.points),
        explanation: showExpectedAnswers ? question.explanation : null,
        passage_text: question.passageText,
        task_instructions: question.taskInstructions,
        vocabulary: mapVocabularyDto(question.vocabulary),
        sort_order: question.sortOrder,
        attachments: question.sourceQuestionId
          ? attachmentsBySource.get(question.sourceQuestionId) ?? []
          : [],
        answers: (question.answerSnapshots ?? [])
          .slice()
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .map((answer) => ({
            id: answer.id,
            snapshot_id: answer.id,
            text: answer.body,
            body: answer.body,
            sort_order: answer.sortOrder,
            ...(showExpectedAnswers ? { is_correct: answer.isCorrect } : {}),
          })),
      })),
      answers: answers.map((answer) => ({
        question_snapshot_id: answer.questionSnapshotId,
        attempt_answer_id: answer.id,
        selected_answer_snapshot_ids: (answer.selections ?? []).map(
          (selection) => selection.answerSnapshotId,
        ),
        text: answer.textAnswer,
        has_audio: Boolean(answer.audioStorageKey),
        audio_url: answer.audioStorageKey
          ? `/api/homework/attempts/${attemptId}/answers/${answer.id}/audio`
          : null,
        audio_mime: answer.audioMime,
        audio_original_filename: answer.audioOriginalFilename,
        audio_duration_ms: answer.audioDurationMs,
        review_comment: showStudentReview ? answer.reviewComment : null,
        ...(isManager || showStudentReview
          ? {
              is_correct: answer.isCorrect,
              earned_points:
                answer.earnedPoints != null ? Number(answer.earnedPoints) : null,
            }
          : {}),
      })),
      result: result ? this.serializeHomeworkResult(result) : null,
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
      where: { assignmentId },
      order: { startedAt: 'DESC' },
    });
    if (attempt) {
      const state = await this.getAttemptState(user, attempt.id);
      const enriched = await this.enrichAssignmentDtos([assignment], assignment.homework);
      const detail = enriched[0];
      return {
        ...state,
        ...detail,
        questions: state.questions,
        answers: state.answers,
        result: state.result,
        progress: {
          answered: (state.answers ?? []).filter(
            (answer: { text?: string | null; selected_answer_snapshot_ids?: string[]; has_audio?: boolean }) =>
              Boolean(answer.text) ||
              Boolean(answer.has_audio) ||
              (answer.selected_answer_snapshot_ids?.length ?? 0) > 0,
          ).length,
          total: (state.questions ?? []).length,
        },
      };
    }

    const enriched = await this.enrichAssignmentDtos([assignment], assignment.homework);
    const detail = enriched[0];

    // Tutor flow for local tutor-students stores result without creating an attempt.
    const localResult = await this.results.findOne({
      where: { assignmentId, attemptId: IsNull() },
    });

    return {
      ...detail,
      submitted_at: assignment.submittedAt,
      answers: [],
      questions: [],
      progress: {
        answered: 0,
        total: assignment.homework.items?.length ?? detail.item_count ?? 0,
      },
      result: localResult
        ? {
            ...this.serializeHomeworkResult(localResult),
            manual: true,
            review_result: localResult.reviewResult,
            owner_comment: localResult.ownerComment,
            student_feedback: localResult.ownerComment,
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
    const allowed = new Set([
      'completed',
      'not_completed',
      'reviewed',
      'checked',
      'needs_revision',
      'cancelled',
    ]);
    if (!allowed.has(normalized)) {
      throw new BadRequestException('Unsupported local homework status');
    }

    const resultStatusByNormalized: Record<string, HomeworkAssignmentStatus> = {
      completed: HomeworkAssignmentStatus.Submitted,
      not_completed: HomeworkAssignmentStatus.Assigned,
      reviewed: HomeworkAssignmentStatus.Checked,
      checked: HomeworkAssignmentStatus.Checked,
      needs_revision: HomeworkAssignmentStatus.NeedsRevision,
      cancelled: HomeworkAssignmentStatus.Cancelled,
    };
    const resultStatus = resultStatusByNormalized[normalized];
    const now = new Date();

    assignment.manualStatus = resultStatus;
    assignment.ownerComment = dto.comment?.trim() || null;
    assignment.reviewResult = dto.result?.trim() || null;

    assignment.manualCheckedAt =
      resultStatus === HomeworkAssignmentStatus.Checked ||
      resultStatus === HomeworkAssignmentStatus.NeedsRevision
        ? now
        : null;
    assignment.checkedAt =
      resultStatus === HomeworkAssignmentStatus.Checked ||
      resultStatus === HomeworkAssignmentStatus.NeedsRevision
        ? now
        : null;
    assignment.checkedByUserId =
      resultStatus === HomeworkAssignmentStatus.Checked ||
      resultStatus === HomeworkAssignmentStatus.NeedsRevision
        ? user.sub
        : null;
    assignment.returnedForRevisionAt =
      resultStatus === HomeworkAssignmentStatus.NeedsRevision ? now : null;
    assignment.status = resultStatus;
    if (
      resultStatus === HomeworkAssignmentStatus.Submitted ||
      resultStatus === HomeworkAssignmentStatus.Checked
    ) {
      assignment.submittedAt = assignment.submittedAt ?? now;
      assignment.startedAt = assignment.startedAt ?? now;
    }

    // Persist local execution metadata into AssignmentResult, without creating HomeworkAttempt.
    const completedAt = resultStatus !== HomeworkAssignmentStatus.Assigned ? now : null;
    const checkedAt =
      resultStatus === HomeworkAssignmentStatus.Checked ||
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

  async cancelAssignment(user: JwtPayload, assignmentId: string) {
    await this.assertManagerOrAdmin(user);
    const assignment = await this.assignments.findOne({
      where: { id: assignmentId },
      relations: ['homework'],
    });
    if (!assignment?.homework) {
      throw new NotFoundException('Assignment not found');
    }
    await this.assertCanViewHomework(user, assignment.homework);
    if (
      assignment.status === HomeworkAssignmentStatus.Checked ||
      assignment.status === HomeworkAssignmentStatus.Submitted
    ) {
      throw new ConflictException('Нельзя отменить задание после отправки или проверки');
    }
    if (assignment.status === HomeworkAssignmentStatus.Cancelled) {
      return (await this.enrichAssignmentDtos([assignment], assignment.homework))[0];
    }
    assignment.status = HomeworkAssignmentStatus.Cancelled;
    await this.assignments.save(assignment);
    return (await this.enrichAssignmentDtos([assignment], assignment.homework))[0];
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
          taskInstructions: item.task_instructions?.trim() || null,
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

  private async replaceTasks(
    user: JwtPayload,
    homeworkId: string,
    tasks: HomeworkTaskDto[],
  ) {
    await this.homeworkTasks.delete({ homeworkId });
    for (const [idx, task] of tasks.entries()) {
      if (task.task_kind === 'question') {
        if (!task.question_id) {
          throw new BadRequestException('question task requires question_id');
        }
        const q = await this.assessmentQuestions.findOne({
          where: { id: task.question_id },
        });
        if (!q) throw new BadRequestException(`Question ${task.question_id} not found`);
        if (q.bankScope && q.bankScope !== 'assessment') {
          throw new BadRequestException(
            `Question ${task.question_id} принадлежит банку HSK и нельзя использовать в домашнем задании`,
          );
        }
        if (q.createdByUserId && q.createdByUserId !== user.sub && user.role !== 'admin') {
          throw new ForbiddenException('Cannot use another author question');
        }
      } else if (task.task_kind === 'reading') {
        const readingTaskId = task.reading_task_id;
        if (!readingTaskId) {
          throw new BadRequestException('reading task requires reading_task_id');
        }
        const rt = await this.readingTasks.findOne({ where: { id: readingTaskId } });
        if (!rt) {
          throw new BadRequestException(`Reading task ${readingTaskId} not found`);
        }
        if (rt.createdByUserId && rt.createdByUserId !== user.sub && user.role !== 'admin') {
          throw new ForbiddenException('Cannot use another author reading task');
        }
        await this.homeworkTasks.save(
          this.homeworkTasks.create({
            homeworkId,
            taskKind: task.task_kind,
            sortOrder: task.sort_order ?? idx,
            questionId: null,
            readingTaskId,
            listeningTaskId: null,
            points: task.points != null ? String(task.points) : null,
          }),
        );
        continue;
      } else if (task.task_kind === 'listening') {
        const listeningTaskId = task.listening_task_id;
        if (!listeningTaskId) {
          throw new BadRequestException('listening task requires listening_task_id');
        }
        const lt = await this.listeningTasks.findOne({ where: { id: listeningTaskId } });
        if (!lt) {
          throw new BadRequestException(`Listening task ${listeningTaskId} not found`);
        }
        if (lt.createdByUserId && lt.createdByUserId !== user.sub && user.role !== 'admin') {
          throw new ForbiddenException('Cannot use another author listening task');
        }
        await this.homeworkTasks.save(
          this.homeworkTasks.create({
            homeworkId,
            taskKind: task.task_kind,
            sortOrder: task.sort_order ?? idx,
            questionId: null,
            readingTaskId: null,
            listeningTaskId,
            points: task.points != null ? String(task.points) : null,
          }),
        );
        continue;
      } else {
        throw new BadRequestException(`Unknown task_kind: ${task.task_kind}`);
      }
      await this.homeworkTasks.save(
        this.homeworkTasks.create({
          homeworkId,
          taskKind: task.task_kind,
          sortOrder: task.sort_order ?? idx,
          questionId: task.question_id ?? null,
          readingTaskId: null,
          listeningTaskId: null,
          points: task.points != null ? String(task.points) : null,
        }),
      );
    }
  }

  /** Expand homework_tasks into homework_items for the existing attempt snapshot pipeline. */
  private async materializeItemsFromTasks(homeworkId: string) {
    const tasks = await this.homeworkTasks.find({
      where: { homeworkId },
      order: { sortOrder: 'ASC' },
      relations: [
        'question',
        'question.answers',
        'readingTask',
        'readingTask.questions',
        'readingTask.questions.answers',
        'readingTask.vocabulary',
        'listeningTask',
        'listeningTask.questions',
        'listeningTask.questions.answers',
        'listeningTask.vocabulary',
      ],
    });
    if (!tasks.length) return;

    const items: Array<HomeworkItemDto & { source_question_id?: string }> = [];
    for (const task of tasks) {
      if (task.taskKind === 'question' && task.question) {
        const q = task.question;
        items.push({
          type: q.type as QuestionType,
          stem: q.stem,
          points: task.points != null ? Number(task.points) : Number(q.points),
          difficulty: q.difficulty,
          explanation: q.explanation ?? undefined,
          section_key: 'test',
          source_question_id: q.id,
          answers: (q.answers ?? []).map((a) => ({
            text: a.text,
            is_correct: a.isCorrect,
            sort_order: a.sortOrder,
          })),
        });
        continue;
      }
      if (task.taskKind === 'reading' && task.readingTask) {
        const rt = task.readingTask;
        const nested = [...(rt.questions ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
        for (const q of nested) {
          items.push({
            type: q.type as QuestionType,
            stem: q.stem,
            points: Number(q.points),
            difficulty: 1,
            explanation: q.explanation ?? undefined,
            section_key: 'reading',
            passage_text: rt.textContent ?? undefined,
            task_instructions: rt.instructions ?? undefined,
            source_question_id: q.id,
            answers: (q.answers ?? []).map((a) => ({
              text: a.text,
              is_correct: a.isCorrect,
              sort_order: a.sortOrder,
            })),
          });
        }
        continue;
      }
      if (task.taskKind === 'listening' && task.listeningTask) {
        const lt = task.listeningTask;
        const nested = [...(lt.questions ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
        for (const q of nested) {
          items.push({
            type: q.type as QuestionType,
            stem: q.stem,
            points: Number(q.points),
            difficulty: 1,
            explanation: q.explanation ?? undefined,
            section_key: 'listening',
            task_instructions: lt.instructions ?? undefined,
            source_question_id: q.id,
            answers: (q.answers ?? []).map((a) => ({
              text: a.text,
              is_correct: a.isCorrect,
              sort_order: a.sortOrder,
            })),
          });
        }
      }
    }
    if (items.length) {
      await this.replaceItemsFromLibrary(homeworkId, items);
    }
  }

  private async replaceItemsFromLibrary(
    homeworkId: string,
    items: Array<
      HomeworkItemDto & { source_question_id?: string }
    >,
  ) {
    for (const [index, item] of items.entries()) {
      this.assertInlineItemValid(item, index);
    }
    await this.items.delete({ homeworkId });
    for (const [idx, item] of items.entries()) {
      const saved = await this.items.save(
        this.items.create({
          homeworkId,
          questionId: item.source_question_id ?? null,
          type: item.type,
          stem: item.stem.trim(),
          difficulty: item.difficulty ?? 1,
          explanation: item.explanation?.trim() || null,
          sectionKey: item.section_key || this.sectionKeyForType(item.type),
          sortOrder: item.sort_order ?? idx,
          points: item.points != null ? String(item.points) : '1',
          passageText: item.passage_text?.trim() || null,
          taskInstructions: item.task_instructions?.trim() || null,
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
    if (type === QuestionType.Speaking) return 'speaking';
    if (type === QuestionType.Translation || type === QuestionType.ShortText) {
      return 'writing';
    }
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

    const readingSourceIds = items
      .filter((item) => item.sectionKey === 'reading' && item.questionId)
      .map((item) => item.questionId as string);
    const listeningSourceIds = items
      .filter((item) => item.sectionKey === 'listening' && item.questionId)
      .map((item) => item.questionId as string);

    const readingQs = readingSourceIds.length
      ? await this.readingQuestions.find({
          where: { id: In(readingSourceIds) },
          relations: ['task', 'task.vocabulary'],
        })
      : [];
    const listeningQs = listeningSourceIds.length
      ? await this.listeningQuestions.find({
          where: { id: In(listeningSourceIds) },
          relations: ['task', 'task.vocabulary'],
        })
      : [];
    const vocabBySource = new Map<string, ReturnType<typeof mapVocabularyDto>>();
    for (const q of readingQs) {
      vocabBySource.set(q.id, mapVocabularyDto(q.task?.vocabulary));
    }
    for (const q of listeningQs) {
      vocabBySource.set(q.id, mapVocabularyDto(q.task?.vocabulary));
    }

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
          taskInstructions: full.taskInstructions,
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
      const vocab =
        full.questionId && vocabBySource.has(full.questionId)
          ? vocabBySource.get(full.questionId)!
          : [];
      if (vocab.length) {
        await this.snapshotVocabulary.save(
          vocab.map((row, index) =>
            this.snapshotVocabulary.create({
              questionSnapshotId: questionSnapshot.id,
              word: row.word,
              pinyin: row.pinyin,
              translation: row.translation,
              explanation: row.explanation,
              sortOrder: row.sort_order ?? index,
            }),
          ),
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
      if (isManualReviewQuestionType(question.type)) continue;
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
      gradingMode: 'auto' as const,
      showCorrectAnswers: result?.showCorrectAnswers ?? false,
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

    const assignmentIds = assignments.map((row) => row.id);
    const checkedByIds = [
      ...new Set(assignments.map((row) => row.checkedByUserId).filter(Boolean)),
    ] as string[];

    const [attempts, results, itemCounts, checkers] = await Promise.all([
      assignmentIds.length
        ? this.attempts.find({
            where: { assignmentId: In(assignmentIds) },
            order: { startedAt: 'DESC' },
          })
        : Promise.resolve([] as HomeworkAttemptEntity[]),
      assignmentIds.length
        ? this.results.find({ where: { assignmentId: In(assignmentIds) } })
        : Promise.resolve([] as HomeworkResultEntity[]),
      homeworks.length
        ? this.items
            .createQueryBuilder('i')
            .select('i.homework_id', 'homework_id')
            .addSelect('COUNT(*)', 'cnt')
            .where('i.homework_id IN (:...ids)', { ids: homeworks.map((hw) => hw.id) })
            .groupBy('i.homework_id')
            .getRawMany<{ homework_id: string; cnt: string }>()
        : Promise.resolve([] as Array<{ homework_id: string; cnt: string }>),
      checkedByIds.length
        ? this.users.find({ where: { id: In(checkedByIds) } })
        : Promise.resolve([] as UserEntity[]),
    ]);

    const latestAttemptByAssignment = new Map<string, HomeworkAttemptEntity>();
    for (const attempt of attempts) {
      if (!latestAttemptByAssignment.has(attempt.assignmentId)) {
        latestAttemptByAssignment.set(attempt.assignmentId, attempt);
      }
    }
    const attemptIds = [...latestAttemptByAssignment.values()].map((row) => row.id);
    const answerCounts =
      attemptIds.length > 0
        ? await this.attemptAnswers
            .createQueryBuilder('a')
            .select('a.attempt_id', 'attempt_id')
            .addSelect('COUNT(*)', 'cnt')
            .where('a.attempt_id IN (:...ids)', { ids: attemptIds })
            .andWhere(
              `(
                (a.text_answer IS NOT NULL AND a.text_answer <> '')
                OR a.audio_storage_key IS NOT NULL
                OR EXISTS (
                  SELECT 1 FROM homework_attempt_answer_selections s
                  WHERE s.attempt_answer_id = a.id
                )
              )`,
            )
            .groupBy('a.attempt_id')
            .getRawMany<{ attempt_id: string; cnt: string }>()
        : [];
    const answeredByAttempt = new Map(
      answerCounts.map((row) => [row.attempt_id, Number(row.cnt)]),
    );
    const questionCountsByAttempt =
      attemptIds.length > 0
        ? await this.questionSnapshots
            .createQueryBuilder('q')
            .select('q.attempt_id', 'attempt_id')
            .addSelect('COUNT(*)', 'cnt')
            .where('q.attempt_id IN (:...ids)', { ids: attemptIds })
            .groupBy('q.attempt_id')
            .getRawMany<{ attempt_id: string; cnt: string }>()
        : [];
    const questionsByAttempt = new Map(
      questionCountsByAttempt.map((row) => [row.attempt_id, Number(row.cnt)]),
    );

    const itemCountByHomework = new Map(
      itemCounts.map((row) => [row.homework_id, Number(row.cnt)]),
    );
    const resultByAssignment = new Map<string, HomeworkResultEntity>();
    for (const result of results) {
      const prev = resultByAssignment.get(result.assignmentId);
      if (!prev || (result.completedAt && (!prev.completedAt || result.completedAt > prev.completedAt))) {
        resultByAssignment.set(result.assignmentId, result);
      }
    }
    const checkerNameById = new Map<string, string>();
    for (const user of checkers) {
      const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
      checkerNameById.set(user.id, name);
    }

    return assignments.map((assignment) => {
      const hw =
        homework ??
        homeworkMap?.get(assignment.homeworkId) ??
        assignment.homework ??
        null;
      const ownerInfo = hw ? owners.get(hw.id) ?? null : null;
      const learnerKey = this.learnerMapKey(assignment);
      const learnerInfo = learnerKey ? learners.get(learnerKey) ?? null : null;
      const attempt = latestAttemptByAssignment.get(assignment.id) ?? null;
      const result = resultByAssignment.get(assignment.id) ?? null;
      const itemCount =
        itemCountByHomework.get(assignment.homeworkId) ??
        hw?.items?.length ??
        null;
      const totalQuestions = attempt
        ? questionsByAttempt.get(attempt.id) ?? itemCount ?? 0
        : itemCount ?? 0;
      const answeredQuestions = attempt ? answeredByAttempt.get(attempt.id) ?? 0 : 0;
      const effectiveStatus = this.effectiveAssignmentStatus(assignment);
      return {
        ...this.toAssignmentDto(assignment, hw, ownerInfo, learnerInfo),
        item_count: itemCount,
        needs_manual_review: effectiveStatus === HomeworkAssignmentStatus.Submitted,
        progress: {
          answered: answeredQuestions,
          total: totalQuestions,
        },
        result_percent: result?.percent != null ? Number(result.percent) : null,
        result_score: result?.score != null ? Number(result.score) : null,
        result_max_score: result?.maxScore != null ? Number(result.maxScore) : null,
        result_passed: result?.passed ?? null,
        checked_by_name: assignment.checkedByUserId
          ? checkerNameById.get(assignment.checkedByUserId) ?? null
          : null,
        attempt_id: attempt?.id ?? null,
        attempt_status: attempt?.status ?? null,
      };
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
    if (
      row.status === HomeworkAssignmentStatus.NeedsRevision ||
      row.status === HomeworkAssignmentStatus.Cancelled ||
      row.status === HomeworkAssignmentStatus.Checked ||
      row.status === HomeworkAssignmentStatus.Submitted ||
      row.status === HomeworkAssignmentStatus.Expired
    ) {
      return row.status;
    }
    if (
      (row.status === HomeworkAssignmentStatus.Assigned ||
        row.status === HomeworkAssignmentStatus.Started) &&
      row.dueAt &&
      new Date(row.dueAt).getTime() < Date.now()
    ) {
      return HomeworkAssignmentStatus.Expired;
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
      started_at: assignment.startedAt,
      submitted_at: assignment.submittedAt,
      checked_at: assignment.checkedAt,
      checked_by_user_id: assignment.checkedByUserId,
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
      task_instructions: item.taskInstructions,
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

  async uploadSpeakingAudio(
    user: JwtPayload,
    attemptId: string,
    questionSnapshotId: string,
    file: SpeakingAudioFile,
    durationMs?: number | null,
  ) {
    const attempt = await this.requireMutableAttempt(user, attemptId);
    const qSnap = await this.questionSnapshots.findOne({
      where: { id: questionSnapshotId, attemptId: attempt.id },
    });
    if (!qSnap) {
      throw new BadRequestException('question_snapshot_id does not belong to this Attempt');
    }
    if (qSnap.type !== QuestionType.Speaking) {
      throw new BadRequestException('Audio upload is only allowed for speaking questions');
    }

    const stored = storeSpeakingAudio(file);
    let answer = await this.attemptAnswers.findOne({
      where: { attemptId: attempt.id, questionSnapshotId },
    });

    if (answer?.audioStorageKey) {
      deleteSpeakingAudio(answer.audioStorageKey);
    }

    const audioPatch = {
      audioStorageKey: stored.storageKey,
      audioMime: stored.mime,
      audioOriginalFilename: stored.originalFilename,
      audioDurationMs:
        durationMs != null && Number.isFinite(durationMs) ? Math.round(durationMs) : null,
    };

    if (!answer) {
      answer = await this.attemptAnswers.save(
        this.attemptAnswers.create({
          attemptId: attempt.id,
          questionSnapshotId,
          textAnswer: null,
          ...audioPatch,
        }),
      );
    } else {
      Object.assign(answer, audioPatch);
      answer = await this.attemptAnswers.save(answer);
    }

    return {
      attempt_answer_id: answer.id,
      question_snapshot_id: questionSnapshotId,
      has_audio: true,
      audio_url: `/api/homework/attempts/${attempt.id}/answers/${answer.id}/audio`,
      audio_mime: answer.audioMime,
      audio_original_filename: answer.audioOriginalFilename,
      audio_duration_ms: answer.audioDurationMs,
    };
  }

  async streamSpeakingAudio(
    user: JwtPayload,
    attemptId: string,
    attemptAnswerId: string,
  ): Promise<StreamableFile> {
    const attempt = await this.attempts.findOne({ where: { id: attemptId } });
    if (!attempt) throw new NotFoundException('Attempt not found');
    await this.assertCanAccessAttempt(user, attempt);

    const answer = await this.attemptAnswers.findOne({
      where: { id: attemptAnswerId, attemptId },
    });
    if (!answer?.audioStorageKey) {
      throw new NotFoundException('Audio not found');
    }
    const path = resolveSpeakingAudioPath(answer.audioStorageKey);
    if (!path) {
      throw new NotFoundException('Audio file missing on disk');
    }
    return new StreamableFile(createReadStream(path), {
      type: answer.audioMime ?? 'audio/mpeg',
      disposition: buildContentDisposition(
        'inline',
        answer.audioOriginalFilename ?? answer.audioStorageKey,
      ),
    });
  }

  async saveReview(
    user: JwtPayload,
    assignmentId: string,
    dto: SaveHomeworkReviewDto,
  ) {
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
    if (!attempt) {
      throw new BadRequestException('Нет отправленной работы для проверки');
    }

    const result = await this.results.findOne({ where: { attemptId: attempt.id } });
    if (!result || result.status !== 'pending_review') {
      throw new ConflictException('Работа не ожидает проверки');
    }

    const qSnaps = await this.questionSnapshots.find({
      where: { attemptId: attempt.id },
    });
    const qById = new Map(qSnaps.map((q) => [q.id, q]));
    const now = new Date();

    for (const row of dto.answers ?? []) {
      const qSnap = qById.get(row.question_snapshot_id);
      if (!qSnap) {
        throw new BadRequestException(
          `Unknown question snapshot: ${row.question_snapshot_id}`,
        );
      }
      const maxPoints = Number(qSnap.points);
      if (row.score < 0 || row.score > maxPoints) {
        throw new BadRequestException(
          `Score must be between 0 and ${maxPoints} for this question`,
        );
      }

      let answer = await this.attemptAnswers.findOne({
        where: {
          attemptId: attempt.id,
          questionSnapshotId: row.question_snapshot_id,
        },
      });
      const isCorrect =
        row.score >= maxPoints ? true : row.score <= 0 ? false : null;
      const comment =
        row.comment == null || String(row.comment).trim() === ''
          ? null
          : String(row.comment).trim();

      if (!answer) {
        answer = await this.attemptAnswers.save(
          this.attemptAnswers.create({
            attemptId: attempt.id,
            questionSnapshotId: row.question_snapshot_id,
            textAnswer: null,
            earnedPoints: String(row.score),
            isCorrect,
            reviewComment: comment,
            reviewedByUserId: user.sub,
            reviewedAt: now,
          }),
        );
      } else {
        answer.earnedPoints = String(row.score);
        answer.isCorrect = isCorrect;
        answer.reviewComment = comment;
        answer.reviewedByUserId = user.sub;
        answer.reviewedAt = now;
        await this.attemptAnswers.save(answer);
      }
    }

    this.applyReviewMeta(result, assignment, dto);
    const totals = await this.sumAttemptPoints(attempt.id);
    this.applyResultPercent(result, totals.earned, totals.max);
    await this.results.save(result);
    await this.assignments.save(assignment);

    return this.getAttemptState(user, attempt.id);
  }

  async finalizeReview(
    user: JwtPayload,
    assignmentId: string,
    dto?: SaveHomeworkReviewDto,
  ) {
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
    if (!attempt) {
      throw new BadRequestException('Нет отправленной работы для проверки');
    }

    const result = await this.results.findOne({ where: { attemptId: attempt.id } });
    if (!result || result.status !== 'pending_review') {
      throw new ConflictException('Работа не ожидает проверки');
    }

    if (dto) {
      if (dto.answers?.length) {
        await this.saveReview(user, assignmentId, dto);
      } else {
        this.applyReviewMeta(result, assignment, dto);
        await this.results.save(result);
        await this.assignments.save(assignment);
      }
    }

    const freshAssignment = await this.assignments.findOne({
      where: { id: assignmentId },
      relations: ['homework'],
    });
    if (!freshAssignment?.homework) {
      throw new NotFoundException('Assignment not found');
    }

    const freshResult = await this.results.findOne({ where: { attemptId: attempt.id } });
    if (!freshResult) {
      throw new ConflictException('Работа не ожидает проверки');
    }

    const qSnaps = await this.questionSnapshots.find({
      where: { attemptId: attempt.id },
    });
    const answers = await this.attemptAnswers.find({
      where: { attemptId: attempt.id },
    });
    const answerByQ = new Map(answers.map((a) => [a.questionSnapshotId, a]));

    let totalScore = 0;
    let totalMax = 0;
    for (const qSnap of qSnaps) {
      const points = Number(qSnap.points);
      totalMax += points;
      const ans = answerByQ.get(qSnap.id);
      if (isManualReviewQuestionType(qSnap.type)) {
        if (ans?.earnedPoints == null || ans.earnedPoints === '') {
          throw new BadRequestException(
            'All manual questions must be scored before finishing review',
          );
        }
        totalScore += Number(ans.earnedPoints);
      } else {
        totalScore += Number(ans?.earnedPoints ?? 0);
      }
    }

    let percent: number;
    try {
      percent = resolveHomeworkPercent({
        gradingMode: freshResult.gradingMode,
        manualPercentage: freshResult.manualPercentage,
        earnedPoints: totalScore,
        maxPoints: totalMax,
      });
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Некорректный процент выполнения',
      );
    }
    const passPercent =
      freshAssignment.homework.passScorePercent != null
        ? Number(freshAssignment.homework.passScorePercent)
        : 60;
    const passed = percent >= passPercent;

    freshResult.score = String(totalScore);
    freshResult.maxScore = String(totalMax);
    freshResult.percent = String(percent);
    freshResult.passed = passed;
    freshResult.status = 'checked';
    await this.results.save(freshResult);

    const now = new Date();
    freshAssignment.status = HomeworkAssignmentStatus.Checked;
    freshAssignment.reviewResult = passed
      ? `Проверено: ${percent}%`
      : `Проверено: ${percent}% (ниже порога)`;
    freshAssignment.manualCheckedAt = now;
    freshAssignment.checkedAt = now;
    freshAssignment.checkedByUserId = user.sub;
    freshAssignment.submittedAt =
      freshAssignment.submittedAt ?? attempt.submittedAt ?? now;
    await this.assignments.save(freshAssignment);

    if (attempt.studentId) {
      const learner = await this.students.findOne({ where: { id: attempt.studentId } });
      if (learner) {
        this.notifier.notifyReviewed(
          freshAssignment,
          freshAssignment.homework,
          {
            userId: learner.userId ?? null,
            displayName: this.studentDisplayName(learner),
          },
          freshResult,
        );
      }
    } else if (attempt.tutorStudentId) {
      const learner = await this.tutorStudents.findOne({
        where: { id: attempt.tutorStudentId },
      });
      if (learner) {
        this.notifier.notifyReviewed(
          freshAssignment,
          freshAssignment.homework,
          {
            userId: learner.userId ?? null,
            displayName: this.tutorStudentDisplayName(learner),
          },
          freshResult,
        );
      }
    }

    return this.getAttemptState(user, attempt.id);
  }

  private serializeHomeworkResult(result: HomeworkResultEntity) {
    const mode = normalizeHomeworkGradingMode(result.gradingMode);
    return {
      id: result.id,
      score: result.score != null ? Number(result.score) : null,
      max_score: result.maxScore != null ? Number(result.maxScore) : null,
      percent: result.percent != null ? Number(result.percent) : null,
      passed: result.passed ?? null,
      evaluation_type: result.evaluationType,
      status: result.status,
      duration_seconds: result.durationSeconds,
      breakdown: result.breakdownJson ? JSON.parse(result.breakdownJson) : null,
      grading_mode: mode,
      manual_percentage:
        result.manualPercentage != null ? Number(result.manualPercentage) : null,
      show_correct_answers: Boolean(result.showCorrectAnswers),
      student_feedback: result.ownerComment ?? null,
      owner_comment: result.ownerComment ?? null,
    };
  }

  private applyReviewMeta(
    result: HomeworkResultEntity,
    assignment: HomeworkAssignmentEntity,
    dto: SaveHomeworkReviewDto,
  ): void {
    if (dto.grading_mode) {
      result.gradingMode = normalizeHomeworkGradingMode(dto.grading_mode);
    }
    if (dto.manual_percentage != null && dto.manual_percentage !== undefined) {
      result.manualPercentage = String(dto.manual_percentage);
    }
    if (dto.show_correct_answers != null) {
      result.showCorrectAnswers = Boolean(dto.show_correct_answers);
    }
    const feedback = dto.student_feedback ?? dto.comment;
    if (feedback !== undefined) {
      const text = feedback == null || String(feedback).trim() === ''
        ? null
        : String(feedback).trim();
      result.ownerComment = text;
      assignment.ownerComment = text;
    }
  }

  private applyResultPercent(
    result: HomeworkResultEntity,
    earned: number,
    maxPoints: number,
  ): void {
    result.score = String(earned);
    result.maxScore = String(maxPoints);
    const mode = normalizeHomeworkGradingMode(result.gradingMode);
    if (mode === 'manual') {
      if (result.manualPercentage == null || result.manualPercentage === '') {
        return;
      }
      try {
        result.percent = String(
          resolveHomeworkPercent({
            gradingMode: 'manual',
            manualPercentage: result.manualPercentage,
            earnedPoints: earned,
            maxPoints,
          }),
        );
      } catch (err) {
        throw new BadRequestException(
          err instanceof Error ? err.message : 'Некорректный процент выполнения',
        );
      }
      return;
    }
    result.percent = String(computeAutoHomeworkPercent(earned, maxPoints));
  }

  private async sumAttemptPoints(
    attemptId: string,
  ): Promise<{ earned: number; max: number }> {
    const qSnaps = await this.questionSnapshots.find({ where: { attemptId } });
    const answers = await this.attemptAnswers.find({ where: { attemptId } });
    const answerByQ = new Map(answers.map((a) => [a.questionSnapshotId, a]));
    let earned = 0;
    let max = 0;
    for (const qSnap of qSnaps) {
      max += Number(qSnap.points);
      earned += Number(answerByQ.get(qSnap.id)?.earnedPoints ?? 0);
    }
    return { earned, max };
  }
}
