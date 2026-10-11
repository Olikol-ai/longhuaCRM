import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { GroupMemberEntity } from '../groups/entities/group-member.entity';
import { AttendanceEntity } from '../lessons/entities/attendance.entity';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { StudentBalanceLedgerService } from '../student-balances/student-balance-ledger.service';
import { shouldDeductLessonBalance } from '../student-balances/student-balance-math';
import { resolveGroupLessonStudentIds } from '../lessons/lesson-group-attendance';

/**
 * School Student lesson balance mutations for CRM lessons.
 *
 * All counter changes go through StudentBalanceLedgerService (idempotent ledger).
 * attendance_records.balance_deducted remains the row-level lock for lesson charge.
 *
 * Participants:
 * - individual → lesson.primaryStudentId
 * - group → attendance snapshot at create (fallback: group_members)
 * Debit only when shouldDeductLessonBalance(status) — never for cancelled/rescheduled/missed/planned.
 */
@Injectable()
export class StudentBalanceService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly ledger: StudentBalanceLedgerService,
  ) {}

  async handleLessonStatusUpdate(
    lessonId: string,
    nextStatus: string,
    manager?: EntityManager,
  ): Promise<void> {
    if (!shouldDeductLessonBalance(nextStatus)) {
      return;
    }

    const run = async (em: EntityManager) => {
      const lessonRepo = em.getRepository(LessonEntity);
      const attendanceRepo = em.getRepository(AttendanceEntity);

      const lesson = await lessonRepo.findOne({ where: { id: lessonId } });
      if (!lesson) {
        return;
      }

      const studentIds = await this.resolveCanonicalStudentIds(lesson, em);
      for (const studentId of studentIds) {
        let attendance = await attendanceRepo.findOne({
          where: { lessonId, studentId },
          lock: { mode: 'pessimistic_write' },
        });

        if (attendance?.balanceDeducted) {
          // Already charged — do not touch the counter again.
          // Legacy rows may lack a ledger debit; never invent a second debit.
          continue;
        }

        if (!attendance) {
          attendance = await attendanceRepo.save(
            attendanceRepo.create({
              lessonId,
              studentId,
              attendanceStatus: 'attended',
              balanceDeducted: false,
            }),
          );
        }

        const marked = await attendanceRepo.update(
          { id: attendance.id, balanceDeducted: false },
          { balanceDeducted: true },
        );
        if (!marked.affected) {
          continue;
        }

        const result = await this.ledger.apply(
          {
            studentId,
            delta: -1,
            operationType: 'debit',
            sourceType: 'lesson',
            sourceId: lessonId,
            idempotencyKey: StudentBalanceLedgerService.debitKey(lessonId, studentId),
            description: `lesson_deduct ${lessonId} status=${nextStatus}`,
          },
          em,
        );

        if (result.applied) {
          await this.audit.log({
            action: 'lesson_balance_change',
            entityType: 'Student',
            entityId: studentId,
            summary: `lesson_deduct ${lessonId} status=${nextStatus}: balance ${result.balanceBefore} → ${result.balanceAfter}`,
          });
        }
      }
    };

    if (manager) {
      await run(manager);
      return;
    }

    await this.dataSource.transaction(run);
  }

  /**
   * Restore 1 lesson when reassigning a CRM student after balance was deducted.
   * Idempotent via attendance.balanceDeducted + ledger restore key.
   */
  async restoreBalanceForReassignment(
    lessonId: string,
    studentId: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const run = async (em: EntityManager): Promise<boolean> => {
      const attendanceRepo = em.getRepository(AttendanceEntity);
      const attendance = await attendanceRepo.findOne({
        where: { lessonId, studentId },
        lock: { mode: 'pessimistic_write' },
      });

      const debitExists = await this.ledger.findByIdempotencyKey(
        StudentBalanceLedgerService.debitKey(lessonId, studentId),
        em,
      );
      const hadDeduction = Boolean(attendance?.balanceDeducted) || Boolean(debitExists);
      if (!hadDeduction) {
        return false;
      }

      if (attendance?.balanceDeducted) {
        const cleared = await attendanceRepo.update(
          { id: attendance.id, balanceDeducted: true },
          { balanceDeducted: false },
        );
        if (!cleared.affected && !debitExists) {
          return false;
        }
      }

      const result = await this.ledger.apply(
        {
          studentId,
          delta: 1,
          operationType: 'restore',
          sourceType: 'lesson',
          sourceId: lessonId,
          idempotencyKey: StudentBalanceLedgerService.restoreKey(lessonId, studentId),
          description: `lesson_restore ${lessonId}`,
        },
        em,
      );

      if (result.applied) {
        await this.audit.log({
          action: 'lesson_balance_change',
          entityType: 'Student',
          entityId: studentId,
          summary: `lesson_restore ${lessonId}: balance ${result.balanceBefore} → ${result.balanceAfter}`,
        });
      }
      return true;
    };

    if (manager) {
      return run(manager);
    }
    return this.dataSource.transaction(run);
  }

  /**
   * Before hard-deleting a lesson, restore every deducted participant.
   * Safe to call repeatedly — restore keys are unique per lesson+student.
   */
  async restoreBalancesForDeletedLesson(
    lessonId: string,
    manager?: EntityManager,
  ): Promise<number> {
    const run = async (em: EntityManager): Promise<number> => {
      const attendanceRepo = em.getRepository(AttendanceEntity);
      const rows = await attendanceRepo.find({
        where: { lessonId, balanceDeducted: true },
        lock: { mode: 'pessimistic_write' },
      });

      let restored = 0;
      const seen = new Set<string>();

      for (const row of rows) {
        if (row.studentId && !seen.has(row.studentId)) {
          seen.add(row.studentId);
          const ok = await this.restoreBalanceForReassignment(lessonId, row.studentId, em);
          if (ok) {
            restored += 1;
          }
        }
      }

      // Ledger debits without attendance flag (edge / legacy catch-up).
      const ledgerDebits = await em.query(
        `SELECT DISTINCT source_id, student_id FROM student_balance_ledger
         WHERE source_type = 'lesson' AND source_id = $1 AND operation_type = 'debit'`,
        [lessonId],
      ) as Array<{ source_id: string; student_id: string }>;

      for (const debit of ledgerDebits) {
        if (seen.has(debit.student_id)) {
          continue;
        }
        seen.add(debit.student_id);
        const ok = await this.restoreBalanceForReassignment(
          lessonId,
          debit.student_id,
          em,
        );
        if (ok) {
          restored += 1;
        }
      }

      return restored;
    };

    if (manager) {
      return run(manager);
    }
    return this.dataSource.transaction(run);
  }

  private async resolveCanonicalStudentIds(
    lesson: LessonEntity,
    manager: EntityManager,
  ): Promise<string[]> {
    const isIndividual = lesson.lessonType === 'individual' && !lesson.groupId;
    if (isIndividual) {
      return lesson.primaryStudentId ? [lesson.primaryStudentId] : [];
    }

    if (lesson.groupId) {
      const attendanceRows = await manager.getRepository(AttendanceEntity).find({
        where: { lessonId: lesson.id },
        select: ['studentId'],
      });
      const members = await manager.getRepository(GroupMemberEntity).find({
        where: { groupId: lesson.groupId },
        select: ['studentId'],
      });
      return resolveGroupLessonStudentIds({
        attendanceStudentIds: attendanceRows.map((row) => row.studentId),
        liveMemberIds: members.map((row) => row.studentId),
      });
    }

    return lesson.primaryStudentId ? [lesson.primaryStudentId] : [];
  }
}
