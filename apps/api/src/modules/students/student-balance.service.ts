import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { LessonEntity } from '../../entities/Lesson.entity';
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

      const studentIds = this.resolveStudentIds(lesson);
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

  private resolveStudentIds(lesson: LessonEntity): string[] {
    if (lesson.studentIds?.length) {
      return lesson.studentIds.filter(Boolean);
    }
    if (lesson.studentId) {
      return [lesson.studentId];
    }
    return [];
  }
}
