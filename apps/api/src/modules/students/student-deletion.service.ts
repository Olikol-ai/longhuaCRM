import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EnrollmentLessonEventEntity } from '../courses/entities/enrollment-lesson-event.entity';
import { EnrollmentEntity } from '../courses/entities/enrollment.entity';
import { CertificateEntity } from '../certificates/entities/certificate.entity';
import { GroupMemberEntity } from '../groups/entities/group-member.entity';
import { AttendanceEntity } from '../lessons/entities/attendance.entity';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { PaymentEntity } from '../payments/entities/payment.entity';
import { SeriesStudentEntity } from '../schedule/entities/series-student.entity';
import { StudentEntity } from './entities/student.entity';

export interface StudentDeleteResult {
  success: true;
}

@Injectable()
export class StudentDeletionService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async deleteStudent(studentId: string): Promise<StudentDeleteResult> {
    await this.dataSource.transaction(async (manager) => {
      const student = await manager.findOne(StudentEntity, {
        where: { id: studentId },
      });
      if (!student) {
        throw new NotFoundException('Student not found');
      }

      await manager.update(PaymentEntity, { studentId }, { studentId: null });
      await manager.update(CertificateEntity, { studentId }, { studentId: null });
      await manager.update(AttendanceEntity, { studentId }, { studentId: null });
      await manager.update(EnrollmentEntity, { studentId }, { studentId: null });
      await manager.update(EnrollmentLessonEventEntity, { studentId }, { studentId: null });
      await manager.update(
        LessonEntity,
        { primaryStudentId: studentId },
        { primaryStudentId: null },
      );

      const alfaTable = await manager.query(
        `SELECT to_regclass('public.alfa_bank_orders') AS name`,
      );
      if (alfaTable[0]?.name) {
        await manager.query(
          `UPDATE "alfa_bank_orders" SET "student_id" = NULL WHERE "student_id" = $1`,
          [studentId],
        );
      }

      await manager.delete(GroupMemberEntity, { studentId });
      await manager.delete(SeriesStudentEntity, { studentId });
      await manager.delete(StudentEntity, { id: studentId });
    });

    return { success: true };
  }
}
