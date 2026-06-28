import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { LessonEntity } from '../../entities/Lesson.entity';
import { LessonStudentEntity } from '../../entities/LessonStudent.entity';
import { StudentEntity } from '../../entities/Student.entity';

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

      const lesson = await lessonRepo.findOne({ where: { id: lessonId } });
      if (!lesson || lesson.balanceDeducted) {
        return;
      }

      const studentIds = await this.resolveStudentIds(lessonId, manager);
      for (const studentId of studentIds) {
        const student = await studentRepo.findOne({ where: { id: studentId } });
        if (!student) continue;
        student.lessonBalance = Math.max(0, (student.lessonBalance ?? 0) - 1);
        student.updatedDate = new Date();
        await studentRepo.save(student);
      }

      lesson.balanceDeducted = true;
      lesson.updatedDate = new Date();
      await lessonRepo.save(lesson);
    });
  }

  private async resolveStudentIds(
    lessonId: string,
    manager: EntityManager,
  ): Promise<string[]> {
    const lsRepo = manager.getRepository(LessonStudentEntity);
    const rows = await lsRepo.find({ where: { lessonId } });
    const ids = rows.map((row) => String(row.studentId)).filter(Boolean);
    if (ids.length > 0) {
      return ids;
    }

    const lesson = await manager.getRepository(LessonEntity).findOne({ where: { id: lessonId } });
    if (lesson?.studentId) {
      return [lesson.studentId];
    }
    return [];
  }
}
