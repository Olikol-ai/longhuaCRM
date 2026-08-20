import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { AttendanceEntity } from '../lessons/entities/attendance.entity';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherStudentBalanceHistoryEntity } from './entities/teacher-student-balance-history.entity';
import { TeacherStudentContactEntity } from './entities/teacher-student-contact.entity';
import { TutorContactBalanceEntity } from './entities/tutor-contact-balance.entity';

/**
 * Balance mutations for notebook contacts.
 *
 * Teacher + linkedStudentId → students.lesson_balance only.
 * Tutor → tutor_contact_balances.lesson_balance only.
 *
 * teacher_student_contacts has no balance column.
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

      const contact = await em.getRepository(TeacherStudentContactEntity).findOne({
        where: { id: contactId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!contact) {
        return;
      }

      const oldBalance = await this.readBalance(em, contact);
      const newBalance = oldBalance - 1;
      await this.writeBalance(em, contact, newBalance);

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
   * or reassigned. Idempotent via attendance.balanceDeducted.
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

      const contact = await em.getRepository(TeacherStudentContactEntity).findOne({
        where: { id: contactId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!contact) {
        return false;
      }

      const oldBalance = await this.readBalance(em, contact);
      const newBalance = oldBalance + 1;
      await this.writeBalance(em, contact, newBalance);

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
    const oldBalance = await this.readBalance(em, contact);
    if (oldBalance === newBalance) {
      return contact;
    }
    await this.writeBalance(em, contact, newBalance);
    await this.writeHistory(em, {
      studentContactId: contact.id,
      oldBalance,
      newBalance,
      reason,
      createdBy,
    });
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

  private async readBalance(
    em: EntityManager,
    contact: TeacherStudentContactEntity,
  ): Promise<number> {
    if (contact.ownerType === 'teacher' && contact.linkedStudentId) {
      const student = await em.getRepository(StudentEntity).findOne({
        where: { id: contact.linkedStudentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (student) {
        return student.lessonBalance ?? 0;
      }
      return 0;
    }

    if (contact.ownerType === 'tutor') {
      const row = await this.lockTutorBalance(em, contact.id);
      return row.lessonBalance ?? 0;
    }

    return 0;
  }

  private async writeBalance(
    em: EntityManager,
    contact: TeacherStudentContactEntity,
    newBalance: number,
  ): Promise<void> {
    if (contact.ownerType === 'teacher' && contact.linkedStudentId) {
      const studentRepo = em.getRepository(StudentEntity);
      const student = await studentRepo.findOne({
        where: { id: contact.linkedStudentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (student) {
        student.lessonBalance = newBalance;
        await studentRepo.save(student);
      }
      return;
    }

    if (contact.ownerType === 'tutor') {
      const row = await this.lockTutorBalance(em, contact.id);
      row.lessonBalance = newBalance;
      await em.getRepository(TutorContactBalanceEntity).save(row);
    }
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
