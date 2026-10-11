import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { AttendanceEntity } from '../lessons/entities/attendance.entity';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { StudentBalanceLedgerService } from '../student-balances/student-balance-ledger.service';
import { shouldDeductLessonBalance } from '../student-balances/student-balance-math';
import { TeacherStudentBalanceHistoryEntity } from './entities/teacher-student-balance-history.entity';
import { TeacherStudentContactEntity } from './entities/teacher-student-contact.entity';
import { TutorContactBalanceEntity } from './entities/tutor-contact-balance.entity';

/**
 * Balance mutations for notebook contacts.
 *
 * Teacher + linkedStudentId → students.lesson_balance via StudentBalanceLedgerService
 *   (same debit/restore keys as CRM StudentBalanceService — no double charge).
 * Tutor → tutor_contact_balances.lesson_balance only (separate wallet).
 *
 * Debit only when shouldDeductLessonBalance(lesson.status).
 */
@Injectable()
export class TeacherStudentContactBalanceService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly ledger: StudentBalanceLedgerService,
  ) {}

  /**
   * Deduct 1 lesson for chargeable contact lesson statuses (completed | missed_no_notice).
   * Idempotent via attendance + ledger key. Never deducts for cancelled/rescheduled/missed/planned.
   */
  async deductForCompletedLesson(
    lessonId: string,
    manager?: EntityManager,
    createdBy?: string | null,
  ): Promise<void> {
    const run = async (em: EntityManager) => {
      const lesson = await em.getRepository(LessonEntity).findOne({
        where: { id: lessonId },
      });
      const contactId = lesson?.primaryTeacherStudentContactId;
      if (!lesson || !contactId) {
        return;
      }
      if (!shouldDeductLessonBalance(lesson.status)) {
        return;
      }

      const attendanceRepo = em.getRepository(AttendanceEntity);
      let attendance = await attendanceRepo.findOne({
        where: { lessonId, teacherStudentContactId: contactId },
        lock: { mode: 'pessimistic_write' },
      });

      if (attendance?.balanceDeducted) {
        // Already charged — never invent a second school debit for legacy rows.
        return;
      }

      if (!attendance) {
        attendance = await attendanceRepo.save(
          attendanceRepo.create({
            lessonId,
            studentId: null,
            tutorStudentId: null,
            teacherStudentContactId: contactId,
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
        return;
      }

      const contact = await em.getRepository(TeacherStudentContactEntity).findOne({
        where: { id: contactId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!contact) {
        return;
      }

      if (contact.ownerType === 'teacher' && contact.linkedStudentId) {
        const result = await this.ledger.apply(
          {
            studentId: contact.linkedStudentId,
            delta: -1,
            operationType: 'debit',
            sourceType: 'lesson',
            sourceId: lessonId,
            idempotencyKey: StudentBalanceLedgerService.debitKey(
              lessonId,
              contact.linkedStudentId,
            ),
            description: `contact_lesson_deduct ${lessonId}`,
            createdByUserId: createdBy ?? null,
          },
          em,
        );
        await this.writeHistory(em, {
          studentContactId: contactId,
          oldBalance: result.balanceBefore,
          newBalance: result.balanceAfter,
          reason: 'Списание за проведённый урок',
          createdBy: createdBy ?? null,
        });
        return;
      }

      if (contact.ownerType === 'tutor') {
        const oldBalance = await this.readTutorBalance(em, contact.id);
        const newBalance = oldBalance - 1;
        await this.writeTutorBalance(em, contact.id, newBalance);
        await this.writeHistory(em, {
          studentContactId: contactId,
          oldBalance,
          newBalance,
          reason: 'Списание за проведённый урок',
          createdBy: createdBy ?? null,
        });
      }
    };

    if (manager) {
      await run(manager);
      return;
    }
    await this.dataSource.transaction(run);
  }

  /**
   * Restore 1 lesson when a previously completed contact lesson is cancelled
   * or reassigned. Idempotent via attendance + ledger restore key.
   */
  async restoreForCancelledLesson(
    lessonId: string,
    manager?: EntityManager,
    createdBy?: string | null,
  ): Promise<boolean> {
    const run = async (em: EntityManager): Promise<boolean> => {
      const lesson = await em.getRepository(LessonEntity).findOne({
        where: { id: lessonId },
      });
      const contactId = lesson?.primaryTeacherStudentContactId;
      if (!lesson || !contactId) {
        return false;
      }

      const attendanceRepo = em.getRepository(AttendanceEntity);
      const attendance = await attendanceRepo.findOne({
        where: { lessonId, teacherStudentContactId: contactId },
        lock: { mode: 'pessimistic_write' },
      });

      const contact = await em.getRepository(TeacherStudentContactEntity).findOne({
        where: { id: contactId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!contact) {
        return false;
      }

      if (contact.ownerType === 'teacher' && contact.linkedStudentId) {
        const debitExists = await this.ledger.findByIdempotencyKey(
          StudentBalanceLedgerService.debitKey(lessonId, contact.linkedStudentId),
          em,
        );
        const hadDeduction = Boolean(attendance?.balanceDeducted) || Boolean(debitExists);
        if (!hadDeduction) {
          return false;
        }

        if (attendance?.balanceDeducted) {
          await attendanceRepo.update(
            { id: attendance.id, balanceDeducted: true },
            { balanceDeducted: false },
          );
        }

        const result = await this.ledger.apply(
          {
            studentId: contact.linkedStudentId,
            delta: 1,
            operationType: 'restore',
            sourceType: 'lesson',
            sourceId: lessonId,
            idempotencyKey: StudentBalanceLedgerService.restoreKey(
              lessonId,
              contact.linkedStudentId,
            ),
            description: `contact_lesson_restore ${lessonId}`,
            createdByUserId: createdBy ?? null,
          },
          em,
        );
        if (result.applied) {
          await this.writeHistory(em, {
            studentContactId: contactId,
            oldBalance: result.balanceBefore,
            newBalance: result.balanceAfter,
            reason: 'Возврат за отменённый урок',
            createdBy: createdBy ?? null,
          });
        }
        return true;
      }

      if (!attendance?.balanceDeducted) {
        return false;
      }

      const cleared = await attendanceRepo.update(
        { id: attendance.id, balanceDeducted: true },
        { balanceDeducted: false },
      );
      if (!cleared.affected) {
        return false;
      }

      if (contact.ownerType === 'tutor') {
        const oldBalance = await this.readTutorBalance(em, contact.id);
        const newBalance = oldBalance + 1;
        await this.writeTutorBalance(em, contact.id, newBalance);
        await this.writeHistory(em, {
          studentContactId: contactId,
          oldBalance,
          newBalance,
          reason: 'Возврат за отменённый урок',
          createdBy: createdBy ?? null,
        });
        return true;
      }

      return false;
    };

    if (manager) {
      return run(manager);
    }
    return this.dataSource.transaction(run);
  }

  async applyManualBalance(
    em: EntityManager,
    contact: TeacherStudentContactEntity,
    newBalance: number,
    reason: string | null,
    createdBy: string | null,
  ): Promise<TeacherStudentContactEntity> {
    if (contact.ownerType === 'teacher' && contact.linkedStudentId) {
      const result = await this.ledger.setAbsolute(
        {
          studentId: contact.linkedStudentId,
          newBalance,
          sourceType: 'adjustment',
          sourceId: contact.id,
          idempotencyKey: `contact-adjust:${contact.id}:${newBalance}:${Date.now()}`,
          description: reason ?? 'contact manual adjustment',
          createdByUserId: createdBy,
          operationType: 'adjustment',
        },
        em,
      );
      if ('entry' in result && result.applied) {
        await this.writeHistory(em, {
          studentContactId: contact.id,
          oldBalance: result.balanceBefore,
          newBalance: result.balanceAfter,
          reason,
          createdBy,
        });
      }
      return contact;
    }

    if (contact.ownerType === 'tutor') {
      const oldBalance = await this.readTutorBalance(em, contact.id);
      if (oldBalance === newBalance) {
        return contact;
      }
      await this.writeTutorBalance(em, contact.id, newBalance);
      await this.writeHistory(em, {
        studentContactId: contact.id,
        oldBalance,
        newBalance,
        reason,
        createdBy,
      });
    }
    return contact;
  }

  /** Ensure a tutor contact has a balance row (0) when created. */
  async ensureTutorBalanceRow(
    em: EntityManager,
    contactId: string,
    initialBalance = 0,
  ): Promise<void> {
    const repo = em.getRepository(TutorContactBalanceEntity);
    const existing = await repo.findOne({ where: { contactId } });
    if (existing) {
      return;
    }
    await repo.save(
      repo.create({
        contactId,
        lessonBalance: Math.trunc(initialBalance),
      }),
    );
  }

  private async readTutorBalance(em: EntityManager, contactId: string): Promise<number> {
    const row = await this.lockTutorBalance(em, contactId);
    return row.lessonBalance ?? 0;
  }

  private async writeTutorBalance(
    em: EntityManager,
    contactId: string,
    newBalance: number,
  ): Promise<void> {
    const row = await this.lockTutorBalance(em, contactId);
    row.lessonBalance = newBalance;
    await em.getRepository(TutorContactBalanceEntity).save(row);
  }

  private async lockTutorBalance(
    em: EntityManager,
    contactId: string,
  ): Promise<TutorContactBalanceEntity> {
    const repo = em.getRepository(TutorContactBalanceEntity);
    let row = await repo.findOne({
      where: { contactId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!row) {
      await repo.save(repo.create({ contactId, lessonBalance: 0 }));
      row = await repo.findOne({
        where: { contactId },
        lock: { mode: 'pessimistic_write' },
      });
    }
    if (!row) {
      throw new Error(`Tutor balance row missing for contact ${contactId}`);
    }
    return row;
  }

  private async writeHistory(
    em: EntityManager,
    input: {
      studentContactId: string;
      oldBalance: number;
      newBalance: number;
      reason: string | null;
      createdBy: string | null;
    },
  ): Promise<void> {
    await em.getRepository(TeacherStudentBalanceHistoryEntity).save(
      em.getRepository(TeacherStudentBalanceHistoryEntity).create({
        id: randomUUID(),
        studentContactId: input.studentContactId,
        oldBalance: input.oldBalance,
        newBalance: input.newBalance,
        changeAmount: input.newBalance - input.oldBalance,
        reason: input.reason,
        createdBy: input.createdBy,
      }),
    );
  }
}
