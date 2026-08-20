import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { GroupMemberEntity } from '../groups/entities/group-member.entity';
import { AttendanceEntity } from '../lessons/entities/attendance.entity';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { StudentEntity } from './entities/student.entity';

const BALANCE_DEDUCT_STATUSES = new Set(['completed', 'missed_no_notice']);

/**
 * School Student lesson balance (SSOT for CRM payments / school lessons / teacher-linked pupils).
 *
 * Lesson participants for balance:
 * - individual → lesson.primaryStudentId
 * - group → group_members (LessonStudent sync target)
 *
 * attendance_records are used only as the idempotency lock (balance_deducted),
 * never as the source of which students to charge.
 *
 * Teacher notebook contacts do not store academic balance — only this table does.
 */
@Injectable()
export class StudentBalanceService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async handleLessonStatusUpdate(
    lessonId: string,
    nextStatus: string,
    manager?: EntityManager,
  ): Promise<void> {
    if (!BALANCE_DEDUCT_STATUSES.has(nextStatus)) {
      return;
    }

    const run = async (em: EntityManager) => {
      const lessonRepo = em.getRepository(LessonEntity);
      const studentRepo = em.getRepository(StudentEntity);
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

        const student = await studentRepo.findOne({
          where: { id: studentId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!student) {
          continue;
        }

        student.lessonBalance = (student.lessonBalance ?? 0) - 1;
        await studentRepo.save(student);
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
   * Idempotent via attendance.balanceDeducted.
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

      const studentRepo = em.getRepository(StudentEntity);
      const student = await studentRepo.findOne({
        where: { id: studentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!student) {
        return false;
      }

      student.lessonBalance = (student.lessonBalance ?? 0) + 1;
      await studentRepo.save(student);
      return true;
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
      const members = await manager.getRepository(GroupMemberEntity).find({
        where: { groupId: lesson.groupId },
        select: ['studentId'],
      });
      return [...new Set(members.map((row) => row.studentId).filter(Boolean))];
    }

    // Defensive: treat as individual if primary is set without group.
    return lesson.primaryStudentId ? [lesson.primaryStudentId] : [];
  }
}
