import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { AttendanceEntity } from '../lessons/entities/attendance.entity';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { TeacherStudentBalanceHistoryEntity } from './entities/teacher-student-balance-history.entity';
import { TeacherStudentContactEntity } from './entities/teacher-student-contact.entity';

/**
 * Private TeacherStudentContact lesson balance.
 * Isolated from school StudentBalanceService / payments / payroll.
 */
@Injectable()
export class TeacherStudentContactBalanceService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Deduct 1 lesson on completed contact lesson. Idempotent via attendance.balanceDeducted.
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

      const attendanceRepo = em.getRepository(AttendanceEntity);
      let attendance = await attendanceRepo.findOne({
        where: { lessonId, teacherStudentContactId: contactId },
        lock: { mode: 'pessimistic_write' },
      });

      if (attendance?.balanceDeducted) {
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

      const contactRepo = em.getRepository(TeacherStudentContactEntity);
      const contact = await contactRepo.findOne({
        where: { id: contactId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!contact) {
        return;
      }

      const oldBalance = contact.lessonBalance ?? 0;
      const newBalance = Math.max(0, oldBalance - 1);
      contact.lessonBalance = newBalance;
      await contactRepo.save(contact);

      await this.writeHistory(em, {
        studentContactId: contactId,
        oldBalance,
        newBalance,
        reason: 'Списание за проведённый урок',
        createdBy: createdBy ?? null,
      });
    };

    if (manager) {
      await run(manager);
      return;
    }
    await this.dataSource.transaction(run);
  }

  /**
   * Restore 1 lesson when a previously completed contact lesson is cancelled
   * or reassigned. Idempotent: only restores if attendance.balanceDeducted was true.
   * @returns true when a lesson was actually restored
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

      const contactRepo = em.getRepository(TeacherStudentContactEntity);
      const contact = await contactRepo.findOne({
        where: { id: contactId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!contact) {
        return false;
      }

      const oldBalance = contact.lessonBalance ?? 0;
      const newBalance = oldBalance + 1;
      contact.lessonBalance = newBalance;
      await contactRepo.save(contact);

      await this.writeHistory(em, {
        studentContactId: contactId,
        oldBalance,
        newBalance,
        reason: 'Возврат за отменённый урок',
        createdBy: createdBy ?? null,
      });
      return true;
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
    const oldBalance = contact.lessonBalance ?? 0;
    if (oldBalance === newBalance) {
      return contact;
    }
    contact.lessonBalance = newBalance;
    await em.getRepository(TeacherStudentContactEntity).save(contact);
    await this.writeHistory(em, {
      studentContactId: contact.id,
      oldBalance,
      newBalance,
      reason,
      createdBy,
    });
    return contact;
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
