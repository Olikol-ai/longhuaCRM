import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { AttendanceEntity } from '../lessons/entities/attendance.entity';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { StudentEntity } from './entities/student.entity';

const BALANCE_DEDUCT_STATUSES = new Set(['completed', 'missed_no_notice']);

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

      const studentIds = await this.resolveStudentIds(lesson, em);
      for (const studentId of studentIds) {
        const attendance = await attendanceRepo.findOne({
          where: { lessonId, studentId },
          lock: { mode: 'pessimistic_write' },
        });

        if (attendance?.balanceDeducted) {
          continue;
        }

        if (attendance) {
          const marked = await attendanceRepo.update(
            { id: attendance.id, balanceDeducted: false },
            { balanceDeducted: true },
          );
          if (!marked.affected) {
            continue;
          }
        }

        const student = await studentRepo.findOne({
          where: { id: studentId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!student) {
          continue;
        }

        student.lessonBalance = Math.max(0, (student.lessonBalance ?? 0) - 1);
        await studentRepo.save(student);
      }
    };

    if (manager) {
      await run(manager);
      return;
    }

    await this.dataSource.transaction(run);
  }

  private async resolveStudentIds(
    lesson: LessonEntity,
    manager: EntityManager,
  ): Promise<string[]> {
    const rows = await manager.getRepository(AttendanceEntity).find({
      where: { lessonId: lesson.id },
    });
    const ids = rows.map((row) => row.studentId).filter(Boolean);
    if (ids.length > 0) {
      return ids;
    }
    if (lesson.primaryStudentId) {
      return [lesson.primaryStudentId];
    }
    return [];
  }
}
