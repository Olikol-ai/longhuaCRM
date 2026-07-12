import {
  BadRequestException,
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
import { AvailabilitySlotEntity } from '../schedule/entities/availability-slot.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';

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
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

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

  async deleteTeacher(teacherId: string): Promise<ProfileDeleteResult> {
    await this.dataSource.transaction(async (manager) => {
      const teacher = await manager.findOne(TeacherEntity, {
        where: { id: teacherId },
      });
      if (!teacher) {
        throw new NotFoundException('Teacher not found');
      }

      const plannedCount = await manager.count(LessonEntity, {
        where: { teacherId, status: 'planned' },
      });
      if (plannedCount > 0) {
        throw new BadRequestException('Cannot delete teacher with planned lessons');
      }

      await this.unassignStudentsFromTeacher(manager, teacherId);
      await this.clearTeacherRelations(manager, teacherId);
      await manager.delete(TeacherEntity, { id: teacherId });
    });

    return { orphanStudents: await this.findOrphanStudents() };
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

  private async clearTeacherRelations(
    manager: EntityManager,
    teacherId: string,
  ): Promise<void> {
    const lessonIds = (
      await manager.find(LessonEntity, {
        where: { teacherId },
        select: ['id'],
      })
    ).map((row) => row.id);

    await manager.delete(AvailabilitySlotEntity, { teacherId });

    if (lessonIds.length > 0) {
      await this.deleteLessonsByIds(manager, lessonIds);
    }
  }

  private async unassignStudentsFromTeacher(
    manager: EntityManager,
    teacherId: string,
  ): Promise<void> {
    await manager.update(
      StudentEntity,
      { assignedTeacherId: teacherId },
      { assignedTeacherId: null },
    );
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
