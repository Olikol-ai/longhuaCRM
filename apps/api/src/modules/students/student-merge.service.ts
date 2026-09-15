import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { EnrollmentLessonEventEntity } from '../courses/entities/enrollment-lesson-event.entity';
import { EnrollmentEntity } from '../courses/entities/enrollment.entity';
import { CertificateEntity } from '../certificates/entities/certificate.entity';
import { GroupMemberEntity } from '../groups/entities/group-member.entity';
import { AttendanceEntity } from '../lessons/entities/attendance.entity';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { PaymentEntity } from '../payments/entities/payment.entity';
import { SeriesStudentEntity } from '../schedule/entities/series-student.entity';
import { StudentEntity } from './entities/student.entity';

export interface StudentMergePreview {
  primaryStudentId: string;
  secondaryStudentId: string;
  primaryBalance: number;
  secondaryBalance: number;
  resultingBalance: number;
  primaryName: string;
  secondaryName: string;
  primaryEmail: string | null;
  secondaryEmail: string | null;
}

export interface StudentMergeResult {
  ok: true;
  primaryStudentId: string;
  secondaryStudentId: string;
  resultingBalance: number;
  movedCounts: Record<string, number>;
}

export interface MergeCandidate {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  assigned_teacher_name: string;
  lesson_balance: number;
  account_status: 'no_account' | 'active_account';
  group_names: string[];
}

@Injectable()
export class StudentMergeService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async previewMerge(
    primaryStudentId: string,
    secondaryStudentId: string,
  ): Promise<StudentMergePreview> {
    const { primary, secondary } = await this.loadMergePair(primaryStudentId, secondaryStudentId);
    return {
      primaryStudentId: primary.id,
      secondaryStudentId: secondary.id,
      primaryBalance: primary.lessonBalance,
      secondaryBalance: secondary.lessonBalance,
      resultingBalance: primary.lessonBalance + secondary.lessonBalance,
      primaryName: primary.name,
      secondaryName: secondary.name,
      primaryEmail: primary.email,
      secondaryEmail: secondary.email,
    };
  }

  async mergeStudents(
    primaryStudentId: string,
    secondaryStudentId: string,
    actorUserId: string,
  ): Promise<StudentMergeResult> {
    const preview = await this.previewMerge(primaryStudentId, secondaryStudentId);
    const movedCounts: Record<string, number> = {};

    await this.dataSource.transaction(async (manager) => {
      const { primary, secondary } = await this.loadMergePair(
        primaryStudentId,
        secondaryStudentId,
        manager,
      );

      movedCounts.group_members = await this.mergeGroupMembers(manager, primary.id, secondary.id);
      movedCounts.lesson_series_students = await this.reassignRows(
        manager,
        'lesson_series_students',
        'student_id',
        primary.id,
        secondary.id,
      );
      movedCounts.lessons = await this.reassignRows(
        manager,
        'lessons',
        'primary_student_id',
        primary.id,
        secondary.id,
      );
      movedCounts.attendance_records = await this.mergeAttendance(manager, primary.id, secondary.id);
      movedCounts.payments = await this.reassignRows(
        manager,
        'payments',
        'student_id',
        primary.id,
        secondary.id,
      );
      movedCounts.certificates = await this.reassignRows(
        manager,
        'certificates',
        'student_id',
        primary.id,
        secondary.id,
      );
      movedCounts.enrollments = await this.reassignRows(
        manager,
        'enrollments',
        'student_id',
        primary.id,
        secondary.id,
      );
      movedCounts.enrollment_lesson_events = await this.reassignRows(
        manager,
        'enrollment_lesson_events',
        'student_id',
        primary.id,
        secondary.id,
      );
      movedCounts.homework_assignments = await this.reassignRows(
        manager,
        'homework_assignments',
        'student_id',
        primary.id,
        secondary.id,
      );
      movedCounts.homework_attempts = await this.reassignRows(
        manager,
        'homework_attempts',
        'student_id',
        primary.id,
        secondary.id,
      );
      movedCounts.assessment_attempts = await this.reassignRows(
        manager,
        'assessment_attempts',
        'student_id',
        primary.id,
        secondary.id,
      );
      movedCounts.teacher_student_contacts = await this.reassignRows(
        manager,
        'teacher_student_contacts',
        'linked_student_id',
        primary.id,
        secondary.id,
      );
      movedCounts.teacher_student_contacts_deduped =
        await this.dedupeTeacherStudentContacts(manager, primary.id);

      if (await this.tableExists(manager, 'lesson_recurrence_series')) {
        movedCounts.lesson_recurrence_series = await this.reassignRows(
          manager,
          'lesson_recurrence_series',
          'primary_student_id',
          primary.id,
          secondary.id,
        );
      }
      if (await this.tableExists(manager, 'exam_academy_sessions')) {
        movedCounts.exam_academy_sessions = await this.reassignRows(
          manager,
          'exam_academy_sessions',
          'student_id',
          primary.id,
          secondary.id,
        );
      }
      if (await this.tableExists(manager, 'alfa_bank_orders')) {
        movedCounts.alfa_bank_orders = await this.reassignRows(
          manager,
          'alfa_bank_orders',
          'student_id',
          primary.id,
          secondary.id,
        );
      }

      await this.reassignAssessmentExamTargets(manager, primary.id, secondary.id);

      const resultingBalance = primary.lessonBalance + secondary.lessonBalance;
      await manager.update(StudentEntity, { id: primary.id }, {
        lessonBalance: resultingBalance,
        updatedAt: new Date(),
      });

      await manager.update(StudentEntity, { id: secondary.id }, {
        status: 'inactive',
        mergedIntoStudentId: primary.id,
        userId: null,
        lessonBalance: 0,
        assignedTeacherId: null,
        updatedAt: new Date(),
      });
    });

    await this.audit.log({
      actorUserId,
      action: 'student_merge',
      entityType: 'Student',
      entityId: primaryStudentId,
      summary: `merged ${secondaryStudentId} → ${primaryStudentId}; balance ${preview.resultingBalance}`,
    });

    return {
      ok: true,
      primaryStudentId,
      secondaryStudentId,
      resultingBalance: preview.resultingBalance,
      movedCounts,
    };
  }

  async findMergeCandidates(params: {
    search?: string;
    primaryStudentId: string;
    limit?: number;
  }): Promise<MergeCandidate[]> {
    const primary = await this.dataSource.getRepository(StudentEntity).findOne({
      where: { id: params.primaryStudentId },
    });
    if (!primary) {
      throw new NotFoundException('Primary student not found');
    }
    if (!primary.userId) {
      throw new BadRequestException('Основной профиль должен иметь аккаунт платформы');
    }

    const limit = Math.min(params.limit ?? 20, 50);
    const q = params.search?.trim();
    const qb = this.dataSource
      .getRepository(StudentEntity)
      .createQueryBuilder('s')
      .leftJoin('teachers', 't', 't.id = s.assigned_teacher_id')
      .where('s.id != :primaryId', { primaryId: primary.id })
      .andWhere("s.status != 'inactive'")
      .andWhere('s.merged_into_student_id IS NULL')
      .andWhere('(s.user_id IS NULL OR s.user_id != :primaryUserId)', {
        primaryUserId: primary.userId,
      })
      .select([
        's.id AS id',
        's.name AS name',
        's.first_name AS first_name',
        's.last_name AS last_name',
        's.email AS email',
        's.phone AS phone',
        's.lesson_balance AS lesson_balance',
        's.user_id AS user_id',
        't.name AS teacher_name',
      ])
      .orderBy('s.name', 'ASC')
      .limit(limit);

    if (q) {
      const pattern = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
      qb.andWhere(
        `(s.name ILIKE :pattern OR s.email ILIKE :pattern OR s.phone ILIKE :pattern
          OR s.first_name ILIKE :pattern OR s.last_name ILIKE :pattern)`,
        { pattern },
      );
    }

    const rows = await qb.getRawMany<{
      id: string;
      name: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      phone: string | null;
      lesson_balance: number;
      user_id: string | null;
      teacher_name: string | null;
    }>();

    const groupNamesByStudent = await this.loadGroupNames(rows.map((r) => r.id));

    return rows.map((row) => ({
      id: row.id,
      full_name: row.name,
      email: row.email,
      phone: row.phone,
      assigned_teacher_name: row.teacher_name ?? '',
      lesson_balance: Number(row.lesson_balance ?? 0),
      account_status: row.user_id ? 'active_account' : 'no_account',
      group_names: groupNamesByStudent.get(row.id) ?? [],
    }));
  }

  private async loadMergePair(
    primaryStudentId: string,
    secondaryStudentId: string,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<{ primary: StudentEntity; secondary: StudentEntity }> {
    if (primaryStudentId === secondaryStudentId) {
      throw new BadRequestException('Нельзя объединить профиль с самим собой');
    }

    const repo = manager.getRepository(StudentEntity);
    const [primary, secondary] = await Promise.all([
      repo.findOne({ where: { id: primaryStudentId } }),
      repo.findOne({ where: { id: secondaryStudentId } }),
    ]);

    if (!primary || !secondary) {
      throw new NotFoundException('Student not found');
    }
    if (primary.status === 'inactive' || secondary.status === 'inactive') {
      throw new ConflictException('Нельзя объединить неактивный профиль ученика');
    }
    if (secondary.mergedIntoStudentId) {
      throw new ConflictException('Выбранный ученик уже был объединён ранее');
    }
    if (!primary.userId) {
      throw new BadRequestException(
        'Основной профиль должен быть аккаунтом платформы (зарегистрированный ученик)',
      );
    }
    if (secondary.userId && secondary.userId !== primary.userId) {
      throw new ConflictException(
        'Нельзя объединить двух учеников с разными аккаунтами. Выберите профиль без аккаунта.',
      );
    }

    return { primary, secondary };
  }

  private async mergeGroupMembers(
    manager: EntityManager,
    primaryId: string,
    secondaryId: string,
  ): Promise<number> {
    const repo = manager.getRepository(GroupMemberEntity);
    const secondaryMembers = await repo.find({ where: { studentId: secondaryId } });
    let moved = 0;
    for (const member of secondaryMembers) {
      const exists = await repo.findOne({
        where: { groupId: member.groupId, studentId: primaryId },
      });
      if (exists) {
        await repo.delete({ id: member.id });
      } else {
        await repo.update({ id: member.id }, { studentId: primaryId });
        moved += 1;
      }
    }
    return moved;
  }

  private async mergeAttendance(
    manager: EntityManager,
    primaryId: string,
    secondaryId: string,
  ): Promise<number> {
    const repo = manager.getRepository(AttendanceEntity);
    const secondaryRows = await repo.find({ where: { studentId: secondaryId } });
    let moved = 0;
    for (const row of secondaryRows) {
      const exists = await repo.findOne({
        where: { lessonId: row.lessonId, studentId: primaryId },
      });
      if (exists) {
        await repo.delete({ id: row.id });
      } else {
        await repo.update({ id: row.id }, { studentId: primaryId });
        moved += 1;
      }
    }
    return moved;
  }

  private async reassignRows(
    manager: EntityManager,
    table: string,
    column: string,
    primaryId: string,
    secondaryId: string,
  ): Promise<number> {
    if (!(await this.tableExists(manager, table))) {
      return 0;
    }
    const result = await manager.query(
      `UPDATE "${table}" SET "${column}" = $1 WHERE "${column}" = $2`,
      [primaryId, secondaryId],
    );
    return Number(result?.[1] ?? result?.rowCount ?? 0);
  }

  /**
   * After merging linked_student_id onto primary, keep one active contact per owner.
   */
  private async dedupeTeacherStudentContacts(
    manager: EntityManager,
    primaryStudentId: string,
  ): Promise<number> {
    if (!(await this.tableExists(manager, 'teacher_student_contacts'))) {
      return 0;
    }
    const rows = (await manager.query(
      `SELECT id, owner_type, owner_id
       FROM teacher_student_contacts
       WHERE linked_student_id = $1
         AND status <> 'inactive'
       ORDER BY created_at ASC`,
      [primaryStudentId],
    )) as Array<{ id: string; owner_type: string; owner_id: string }>;

    const seen = new Set<string>();
    let deactivated = 0;
    for (const row of rows) {
      const key = `${row.owner_type}:${row.owner_id}`;
      if (seen.has(key)) {
        await manager.query(
          `UPDATE teacher_student_contacts
           SET status = 'inactive', updated_at = NOW()
           WHERE id = $1`,
          [row.id],
        );
        deactivated += 1;
      } else {
        seen.add(key);
      }
    }
    return deactivated;
  }

  private async reassignAssessmentExamTargets(
    manager: EntityManager,
    primaryId: string,
    secondaryId: string,
  ): Promise<void> {
    if (!(await this.tableExists(manager, 'assessment_exam_assignments'))) {
      return;
    }
    const duplicates = await manager.query(
      `SELECT sec.id
       FROM assessment_exam_assignments sec
       JOIN assessment_exam_assignments pri
         ON pri.exam_id = sec.exam_id
        AND pri.target_type = 'student'
        AND pri.target_id = $1
       WHERE sec.target_type = 'student'
         AND sec.target_id = $2`,
      [primaryId, secondaryId],
    );
    if (duplicates.length > 0) {
      const ids = duplicates.map((row: { id: string }) => row.id);
      await manager.query(
        `DELETE FROM assessment_exam_assignments WHERE id = ANY($1::uuid[])`,
        [ids],
      );
    }
    await manager.query(
      `UPDATE assessment_exam_assignments
       SET target_id = $1
       WHERE target_type = 'student' AND target_id = $2`,
      [primaryId, secondaryId],
    );
  }

  private async loadGroupNames(studentIds: string[]): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (studentIds.length === 0) {
      return map;
    }
    const rows = await this.dataSource.query(
      `SELECT gm.student_id, g.name
       FROM group_members gm
       JOIN groups g ON g.id = gm.group_id
       WHERE gm.student_id = ANY($1::uuid[])
       ORDER BY g.name`,
      [studentIds],
    );
    for (const row of rows) {
      const list = map.get(row.student_id) ?? [];
      list.push(row.name);
      map.set(row.student_id, list);
    }
    return map;
  }

  private async tableExists(manager: EntityManager, table: string): Promise<boolean> {
    const rows = await manager.query(`SELECT to_regclass($1) AS name`, [`public.${table}`]);
    return Boolean(rows[0]?.name);
  }
}
