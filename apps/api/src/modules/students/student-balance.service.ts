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

  async handleLessonStatusUpdate(lessonId: string, nextStatus: string): Promise<void> {
    if (!BALANCE_DEDUCT_STATUSES.has(nextStatus)) {
      return;
    }

    await this.dataSource.transaction(async (manager) => {
      const lessonRepo = manager.getRepository(LessonEntity);
      const studentRepo = manager.getRepository(StudentEntity);
      const attendanceRepo = manager.getRepository(AttendanceEntity);

      const lesson = await lessonRepo.findOne({ where: { id: lessonId } });
      if (!lesson) {
        return;
      }

      const studentIds = await this.resolveStudentIds(lesson, manager);
      for (const studentId of studentIds) {
        const attendance = await attendanceRepo.findOne({
          where: { lessonId, studentId },
        });
        if (attendance?.balanceDeducted) {
          continue;
        }

        const student = await studentRepo.findOne({ where: { id: studentId } });
        if (!student) continue;
        student.lessonBalance = Math.max(0, (student.lessonBalance ?? 0) - 1);
        await studentRepo.save(student);

        if (attendance) {
          attendance.balanceDeducted = true;
          await attendanceRepo.save(attendance);
        }
      }
    });
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
