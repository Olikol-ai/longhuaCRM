import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import { AttendanceEntity } from '../lessons/entities/attendance.entity';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { EnrollmentEntity } from '../courses/entities/enrollment.entity';
import { PaymentEntity } from '../payments/entities/payment.entity';
import { SeriesStudentEntity } from '../schedule/entities/series-student.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { TeacherDeletionService } from '../teachers/teacher-deletion.service';

export interface OrphanStudentRecord {
  id: string;
  name: string;
  email: string | null;
}

export interface ProfileDeleteResult {
  orphanStudents: OrphanStudentRecord[];
}

@Injectable()
export class ProfileRelationsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly teacherDeletion: TeacherDeletionService,
  ) {}

  async findOrphanStudents(): Promise<OrphanStudentRecord[]> {
    const rows = await this.dataSource.getRepository(StudentEntity).find({
      where: {
        assignedTeacherId: IsNull(),
        status: 'active',
      },
      order: { name: 'ASC' },
    });
    return rows.map((row) => this.toOrphanRecord(row));
  }

  async deleteStudent(studentId: string): Promise<ProfileDeleteResult> {
    await this.dataSource.transaction(async (manager) => {
      const student = await manager.findOne(StudentEntity, {
        where: { id: studentId },
      });
      if (!student) {
        throw new NotFoundException('Student not found');
      }

      await this.clearStudentRelations(manager, studentId);
      await manager.delete(StudentEntity, { id: studentId });
    });

    return { orphanStudents: await this.findOrphanStudents() };
  }

  deleteTeacher(teacherId: string): Promise<ProfileDeleteResult> {
    return this.teacherDeletion.deleteTeacher(teacherId);
  }

  async deleteProfilesForUser(userId: string): Promise<ProfileDeleteResult> {
    const studentRepo = this.dataSource.getRepository(StudentEntity);
    const teacherRepo = this.dataSource.getRepository(TeacherEntity);

    const [linkedStudents, linkedTeachers] = await Promise.all([
      studentRepo.find({ where: { userId } }),
      teacherRepo.find({ where: { userId } }),
    ]);

    for (const teacher of linkedTeachers) {
      await this.deleteTeacher(teacher.id);
    }

    for (const student of linkedStudents) {
      await this.deleteStudent(student.id);
    }

    return { orphanStudents: await this.findOrphanStudents() };
  }

  private async clearStudentRelations(
    manager: EntityManager,
    studentId: string,
  ): Promise<void> {
    const lessonIds = await this.collectStudentLessonIds(manager, studentId);

    await manager.delete(PaymentEntity, { studentId });
    await manager.delete(EnrollmentEntity, { studentId });
    await manager.delete(SeriesStudentEntity, { studentId });
    await manager.delete(AttendanceEntity, { studentId });

    if (lessonIds.length > 0) {
      await this.deleteLessonsByIds(manager, lessonIds);
    }
  }

  private async collectStudentLessonIds(
    manager: EntityManager,
    studentId: string,
  ): Promise<string[]> {
    const [directLessons, attendanceRows] = await Promise.all([
      manager.find(LessonEntity, {
        where: { primaryStudentId: studentId },
        select: ['id'],
      }),
      manager.find(AttendanceEntity, {
        where: { studentId },
        select: ['lessonId'],
      }),
    ]);

    return [
      ...new Set([
        ...directLessons.map((row) => row.id),
        ...attendanceRows.map((row) => row.lessonId),
      ]),
    ];
  }

  private async deleteLessonsByIds(
    manager: EntityManager,
    lessonIds: string[],
  ): Promise<void> {
    if (lessonIds.length === 0) {
      return;
    }

    await manager.delete(AttendanceEntity, { lessonId: In(lessonIds) });
    await manager.delete(LessonEntity, { id: In(lessonIds) });
  }

  private toOrphanRecord(student: StudentEntity): OrphanStudentRecord {
    return {
      id: student.id,
      name: student.name,
      email: student.email ?? null,
    };
  }
}
