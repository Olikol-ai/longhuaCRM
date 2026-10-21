import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import { AssessmentAccessService } from '../../../common/access/assessment-access.service';
import { StudentEntity } from '../../students/entities/student.entity';
import { UserEntity } from '../../users/entities/user.entity';
import {
  AssessmentAttemptEntity,
  AssessmentChangeJournalEntity,
  AssessmentExamAssignmentEntity,
  AssessmentExamEntity,
  AssessmentResultEntity,
} from '../entities';
import { ResultService } from './result.service';

function displayName(
  first?: string | null,
  last?: string | null,
  fallback = '—',
): string {
  const parts = [first, last]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean);
  return parts.length ? parts.join(' ') : fallback;
}

function clampPage(limit?: number, offset?: number) {
  const lim = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const off = Math.max(Number(offset) || 0, 0);
  return { limit: lim, offset: off };
}

@Injectable()
export class AdminAssessmentService {
  constructor(
    private readonly access: AssessmentAccessService,
    private readonly results: ResultService,
    @InjectRepository(AssessmentExamEntity)
    private readonly examRepo: Repository<AssessmentExamEntity>,
    @InjectRepository(AssessmentAttemptEntity)
    private readonly attemptRepo: Repository<AssessmentAttemptEntity>,
    @InjectRepository(AssessmentResultEntity)
    private readonly resultRepo: Repository<AssessmentResultEntity>,
    @InjectRepository(AssessmentExamAssignmentEntity)
    private readonly assignmentRepo: Repository<AssessmentExamAssignmentEntity>,
    @InjectRepository(AssessmentChangeJournalEntity)
    private readonly journalRepo: Repository<AssessmentChangeJournalEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  private assertAdmin(actor: DomainAccessActor): void {
    if (!this.access.isAdmin(actor)) {
      throw new ForbiddenException('Forbidden: admin only');
    }
  }

  async listExams(
    actor: DomainAccessActor,
    query: {
      limit?: number;
      offset?: number;
      search?: string;
      createdByUserId?: string;
      assignedByUserId?: string;
    },
  ) {
    this.assertAdmin(actor);
    const { limit, offset } = clampPage(query.limit, query.offset);

    const qb = this.examRepo
      .createQueryBuilder('e')
      .leftJoin(
        AssessmentExamAssignmentEntity,
        'asg',
        'asg.exam_id = e.id',
      )
      .leftJoin(AssessmentAttemptEntity, 'att', 'att.exam_id = e.id')
      .leftJoin(AssessmentResultEntity, 'r', 'r.attempt_id = att.id')
      .leftJoin(UserEntity, 'creator', 'creator.id = e.created_by_user_id')
      .select('e.id', 'id')
      .addSelect('e.name', 'name')
      .addSelect('e.status', 'status')
      .addSelect('e.source', 'source')
      .addSelect('e.created_by_user_id', 'created_by_user_id')
      .addSelect('e.created_at', 'created_at')
      .addSelect('e.updated_at', 'updated_at')
      .addSelect(
        `NULLIF(TRIM(CONCAT(COALESCE(creator.first_name, ''), ' ', COALESCE(creator.last_name, ''))), '')`,
        'created_by_name',
      )
      .addSelect('COUNT(DISTINCT asg.id)', 'assignment_count')
      .addSelect('COUNT(DISTINCT att.id)', 'attempt_count')
      .addSelect(
        `COUNT(DISTINCT att.id) FILTER (WHERE att.status = 'submitted')`,
        'submitted_attempt_count',
      )
      .addSelect(
        `COUNT(DISTINCT att.id) FILTER (WHERE att.status IN ('created', 'started'))`,
        'open_attempt_count',
      )
      .addSelect(
        `COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'passed')`,
        'passed_count',
      )
      .addSelect(
        `COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'failed')`,
        'failed_count',
      )
      .addSelect(
        `COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'pending_review')`,
        'pending_review_count',
      )
      .addSelect(
        `COUNT(DISTINCT r.id) FILTER (WHERE r.score_source = 'manual')`,
        'manual_score_count',
      )
      .addSelect('MAX(asg.created_at)', 'last_assigned_at')
      .groupBy('e.id')
      .addGroupBy('creator.id')
      .orderBy('e.created_at', 'DESC');

    if (query.search?.trim()) {
      qb.andWhere('e.name ILIKE :search', {
        search: `%${query.search.trim()}%`,
      });
    }
    if (query.createdByUserId) {
      qb.andWhere('e.created_by_user_id = :createdBy', {
        createdBy: query.createdByUserId,
      });
    }
    if (query.assignedByUserId) {
      qb.andWhere('asg.assigned_by_user_id = :assignedBy', {
        assignedBy: query.assignedByUserId,
      });
    }

    const countQb = this.examRepo
      .createQueryBuilder('e')
      .select('COUNT(DISTINCT e.id)', 'cnt');
    if (query.search?.trim()) {
      countQb.andWhere('e.name ILIKE :search', {
        search: `%${query.search.trim()}%`,
      });
    }
    if (query.createdByUserId) {
      countQb.andWhere('e.created_by_user_id = :createdBy', {
        createdBy: query.createdByUserId,
      });
    }
    if (query.assignedByUserId) {
      countQb
        .innerJoin(
          AssessmentExamAssignmentEntity,
          'asg',
          'asg.exam_id = e.id',
        )
        .andWhere('asg.assigned_by_user_id = :assignedBy', {
          assignedBy: query.assignedByUserId,
        });
    }
    const countRaw = await countQb.getRawOne<{ cnt: string }>();
    const total = Number(countRaw?.cnt) || 0;
    const rows = await qb.offset(offset).limit(limit).getRawMany();

    const examIds = rows.map((r) => r.id as string);
    const assignerMap = await this.loadPrimaryAssigners(examIds);

    const items = rows.map((row) => {
      const assigner = assignerMap.get(row.id) ?? null;
      return {
        id: row.id,
        name: row.name,
        status: row.status,
        source: row.source,
        created_by_user_id: row.created_by_user_id,
        created_by_name: row.created_by_name || '—',
        created_at: row.created_at,
        updated_at: row.updated_at,
        last_assigned_at: row.last_assigned_at,
        assignment_count: Number(row.assignment_count) || 0,
        attempt_count: Number(row.attempt_count) || 0,
        submitted_attempt_count: Number(row.submitted_attempt_count) || 0,
        open_attempt_count: Number(row.open_attempt_count) || 0,
        passed_count: Number(row.passed_count) || 0,
        failed_count: Number(row.failed_count) || 0,
        pending_review_count: Number(row.pending_review_count) || 0,
        manual_score_count: Number(row.manual_score_count) || 0,
        primary_assigner_user_id: assigner?.userId ?? null,
        primary_assigner_name: assigner?.name ?? null,
      };
    });

    return { items, total, limit, offset };
  }

  private async loadPrimaryAssigners(
    examIds: string[],
  ): Promise<Map<string, { userId: string; name: string }>> {
    const map = new Map<string, { userId: string; name: string }>();
    if (!examIds.length) return map;

    const rows = await this.assignmentRepo
      .createQueryBuilder('asg')
      .leftJoin(UserEntity, 'u', 'u.id = asg.assigned_by_user_id')
      .select('asg.exam_id', 'exam_id')
      .addSelect('asg.assigned_by_user_id', 'user_id')
      .addSelect('asg.created_at', 'created_at')
      .addSelect('u.first_name', 'first_name')
      .addSelect('u.last_name', 'last_name')
      .where('asg.exam_id IN (:...examIds)', { examIds })
      .andWhere('asg.assigned_by_user_id IS NOT NULL')
      .orderBy('asg.created_at', 'ASC')
      .getRawMany();

    for (const row of rows) {
      if (map.has(row.exam_id)) continue;
      map.set(row.exam_id, {
        userId: row.user_id,
        name: displayName(row.first_name, row.last_name, '—'),
      });
    }
    return map;
  }

  async listAttempts(
    actor: DomainAccessActor,
    query: {
      limit?: number;
      offset?: number;
      examSearch?: string;
      examId?: string;
      studentId?: string;
      studentSearch?: string;
      assignedByUserId?: string;
      attemptStatus?: string;
      resultStatus?: string;
      from?: string;
      to?: string;
      manualOnly?: boolean;
    },
  ) {
    this.assertAdmin(actor);
    const { limit, offset } = clampPage(query.limit, query.offset);

    const qb = this.attemptRepo
      .createQueryBuilder('att')
      .innerJoin(AssessmentExamEntity, 'e', 'e.id = att.exam_id')
      .leftJoin(
        AssessmentExamAssignmentEntity,
        'asg',
        'asg.id = att.assignment_id',
      )
      .leftJoin(AssessmentResultEntity, 'r', 'r.attempt_id = att.id')
      .leftJoin(StudentEntity, 's', 's.id = att.student_id')
      .leftJoin(UserEntity, 'assigner', 'assigner.id = asg.assigned_by_user_id')
      .select('att.id', 'attempt_id')
      .addSelect('att.exam_id', 'exam_id')
      .addSelect('att.assignment_id', 'assignment_id')
      .addSelect('att.student_id', 'student_id')
      .addSelect('att.status', 'attempt_status')
      .addSelect('att.attempt_number', 'attempt_number')
      .addSelect('att.started_at', 'started_at')
      .addSelect('att.submitted_at', 'submitted_at')
      .addSelect('att.created_at', 'created_at')
      .addSelect('e.name', 'exam_name')
      .addSelect('e.status', 'exam_status')
      .addSelect('asg.assigned_by_user_id', 'assigned_by_user_id')
      .addSelect('asg.created_at', 'assigned_at')
      .addSelect(
        `NULLIF(TRIM(CONCAT(COALESCE(assigner.first_name, ''), ' ', COALESCE(assigner.last_name, ''))), '')`,
        'assigned_by_name',
      )
      .addSelect(
        `NULLIF(TRIM(CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, ''))), '')`,
        'student_name',
      )
      .addSelect('r.id', 'result_id')
      .addSelect('r.status', 'result_status')
      .addSelect('r.score', 'score')
      .addSelect('r.auto_score', 'auto_score')
      .addSelect('r.score_source', 'score_source')
      .addSelect('r.max_score', 'max_score')
      .addSelect('r.percent', 'percent')
      .addSelect('r.passed', 'passed')
      .addSelect('r.duration', 'duration')
      .orderBy('COALESCE(att.submitted_at, att.started_at, att.created_at)', 'DESC');

    if (query.examId) {
      qb.andWhere('att.exam_id = :examId', { examId: query.examId });
    }
    if (query.examSearch?.trim()) {
      qb.andWhere('e.name ILIKE :examSearch', {
        examSearch: `%${query.examSearch.trim()}%`,
      });
    }
    if (query.studentId) {
      qb.andWhere('att.student_id = :studentId', {
        studentId: query.studentId,
      });
    }
    if (query.studentSearch?.trim()) {
      qb.andWhere(
        `(COALESCE(s.first_name, '') || ' ' || COALESCE(s.last_name, '')) ILIKE :studentSearch`,
        { studentSearch: `%${query.studentSearch.trim()}%` },
      );
    }
    if (query.assignedByUserId) {
      qb.andWhere('asg.assigned_by_user_id = :assignedBy', {
        assignedBy: query.assignedByUserId,
      });
    }
    if (query.attemptStatus) {
      qb.andWhere('att.status = :attemptStatus', {
        attemptStatus: query.attemptStatus,
      });
    }
    if (query.resultStatus) {
      qb.andWhere('r.status = :resultStatus', {
        resultStatus: query.resultStatus,
      });
    }
    if (query.manualOnly) {
      qb.andWhere('r.score_source = :manual', { manual: 'manual' });
    }
    if (query.from) {
      qb.andWhere(
        'COALESCE(att.submitted_at, att.started_at, att.created_at) >= :from',
        { from: new Date(query.from) },
      );
    }
    if (query.to) {
      qb.andWhere(
        'COALESCE(att.submitted_at, att.started_at, att.created_at) <= :to',
        { to: new Date(query.to) },
      );
    }

    const total = await qb.clone().getCount();
    const rows = await qb.offset(offset).limit(limit).getRawMany();

    const items = rows.map((row) => ({
      attempt_id: row.attempt_id,
      exam_id: row.exam_id,
      exam_name: row.exam_name,
      exam_status: row.exam_status,
      assignment_id: row.assignment_id,
      assigned_by_user_id: row.assigned_by_user_id,
      assigned_by_name: row.assigned_by_name || null,
      assigned_at: row.assigned_at,
      student_id: row.student_id,
      student_name: row.student_name || '—',
      attempt_status: row.attempt_status,
      attempt_number: Number(row.attempt_number) || 1,
      started_at: row.started_at,
      submitted_at: row.submitted_at,
      created_at: row.created_at,
      result_id: row.result_id,
      result_status: row.result_status,
      score: row.score,
      auto_score: row.auto_score,
      score_source: row.score_source,
      max_score: row.max_score,
      percent: row.percent,
      passed: row.passed,
      duration: row.duration,
      has_manual_score: row.score_source === 'manual',
    }));

    return { items, total, limit, offset };
  }

  async getAttemptDetail(actor: DomainAccessActor, attemptId: string) {
    this.assertAdmin(actor);

    const attempt = await this.attemptRepo.findOne({ where: { id: attemptId } });
    if (!attempt) {
      throw new NotFoundException('Attempt not found');
    }

    const exam = await this.examRepo.findOne({ where: { id: attempt.examId } });
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    const assignment = attempt.assignmentId
      ? await this.assignmentRepo.findOne({
          where: { id: attempt.assignmentId },
        })
      : null;

    const student = attempt.studentId
      ? await this.studentRepo.findOne({ where: { id: attempt.studentId } })
      : null;

    const assignerUser = assignment?.assignedByUserId
      ? await this.userRepo.findOne({
          where: { id: assignment.assignedByUserId },
        })
      : null;

    const creatorUser = exam.createdByUserId
      ? await this.userRepo.findOne({ where: { id: exam.createdByUserId } })
      : null;

    const result = await this.resultRepo.findOne({
      where: { attemptId: attempt.id },
      relations: ['breakdowns'],
    });

    let review: Awaited<ReturnType<ResultService['getReviewBundle']>> | null =
      null;
    let scoreHistory: Array<Record<string, unknown>> = [];

    if (result) {
      review = await this.results.getReviewBundle(result.id, actor);
      scoreHistory = await this.listScoreHistory(result.id);
    }

    return {
      attempt: {
        id: attempt.id,
        exam_id: attempt.examId,
        assignment_id: attempt.assignmentId,
        student_id: attempt.studentId,
        teacher_id: attempt.teacherId,
        user_id: attempt.userId,
        status: attempt.status,
        attempt_number: attempt.attemptNumber,
        started_at: attempt.startedAt,
        submitted_at: attempt.submittedAt,
        expires_at: attempt.expiresAt,
        created_at: attempt.createdAt,
      },
      exam: {
        id: exam.id,
        name: exam.name,
        status: exam.status,
        source: exam.source,
        description: exam.description,
        created_by_user_id: exam.createdByUserId,
        created_by_name: displayName(
          creatorUser?.firstName,
          creatorUser?.lastName,
        ),
        created_at: exam.createdAt,
      },
      assignment: assignment
        ? {
            id: assignment.id,
            target_type: assignment.targetType,
            target_id: assignment.targetId,
            status: assignment.status,
            assigned_by_user_id: assignment.assignedByUserId,
            assigned_by_name: displayName(
              assignerUser?.firstName,
              assignerUser?.lastName,
            ),
            created_at: assignment.createdAt,
            valid_from: assignment.validFrom,
            valid_to: assignment.validTo,
          }
        : null,
      student: student
        ? {
            id: student.id,
            name: displayName(student.firstName, student.lastName),
          }
        : null,
      result: review?.result ?? result ?? null,
      review_status: review?.reviewStatus ?? null,
      items: review?.items ?? [],
      manual_pending_count: review?.manualPendingCount ?? 0,
      can_adjust_final_score: review?.canAdjustFinalScore ?? false,
      score_history: scoreHistory,
    };
  }

  async listScoreHistory(resultId: string, limit = 50) {
    const rows = await this.journalRepo.find({
      where: {
        entityType: 'assessment_result',
        entityId: resultId,
        action: 'final_score_adjust',
      },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
    });

    const actorIds = [
      ...new Set(
        rows
          .map((r) => r.actorUserId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ];
    const actors =
      actorIds.length > 0
        ? await this.userRepo
            .createQueryBuilder('u')
            .select(['u.id', 'u.firstName', 'u.lastName'])
            .where('u.id IN (:...ids)', { ids: actorIds })
            .getMany()
        : [];
    const actorName = new Map(
      actors.map((u) => [u.id, displayName(u.firstName, u.lastName)]),
    );

    return rows.map((row) => {
      let oldVersion: unknown = null;
      let newVersion: unknown = null;
      try {
        oldVersion = row.oldVersion ? JSON.parse(row.oldVersion) : null;
      } catch {
        oldVersion = row.oldVersion;
      }
      try {
        newVersion = row.newVersion ? JSON.parse(row.newVersion) : null;
      } catch {
        newVersion = row.newVersion;
      }
      return {
        id: row.id,
        actor_user_id: row.actorUserId,
        actor_name: row.actorUserId
          ? actorName.get(row.actorUserId) || '—'
          : '—',
        summary: row.summary,
        created_at: row.createdAt,
        old_score:
          oldVersion && typeof oldVersion === 'object'
            ? (oldVersion as { score?: unknown }).score ?? null
            : null,
        new_score:
          newVersion && typeof newVersion === 'object'
            ? (newVersion as { score?: unknown }).score ?? null
            : null,
        reason:
          newVersion && typeof newVersion === 'object'
            ? (newVersion as { reason?: unknown }).reason ?? null
            : null,
        old_version: oldVersion,
        new_version: newVersion,
      };
    });
  }

  async getScoreHistoryForResult(actor: DomainAccessActor, resultId: string) {
    this.assertAdmin(actor);
    const result = await this.resultRepo.findOne({ where: { id: resultId } });
    if (!result) {
      throw new NotFoundException('Result not found');
    }
    return {
      result_id: resultId,
      items: await this.listScoreHistory(resultId),
    };
  }
}
