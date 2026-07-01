import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import { AlfaBankOrderEntity } from '../../entities/alfaBankOrder.entity';
import { CourseEntity } from '../../entities/Course.entity';
import { LessonEntity } from '../../entities/Lesson.entity';
import { LessonSeriesStudentEntity } from '../../entities/LessonSeriesStudent.entity';
import { LessonStudentEntity } from '../../entities/LessonStudent.entity';
import { PaymentEntity } from '../../entities/Payment.entity';
import { ScheduleSlotEntity } from '../../entities/ScheduleSlot.entity';
import { StudentEntity } from '../../entities/Student.entity';
import { TeacherEntity } from '../../entities/Teacher.entity';
import { TeacherPaymentEntity } from '../../entities/TeacherPayment.entity';

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
        assignedTeacher: IsNull(),
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
        throw new BadRequestException(
          'Cannot delete teacher with planned lessons',
        );
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

    await manager.delete(AlfaBankOrderEntity, { studentId });
    await manager.delete(PaymentEntity, { studentId });
    await manager.delete(CourseEntity, { studentId });
    await manager.delete(LessonSeriesStudentEntity, { studentId });

    if (lessonIds.length > 0) {
      await this.deleteLessonsByIds(manager, lessonIds);
    }

    await manager.delete(LessonStudentEntity, { studentId });
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

    await manager.delete(TeacherPaymentEntity, { teacherId });
    await manager.delete(ScheduleSlotEntity, { teacherId });

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
      { assignedTeacher: teacherId },
      { assignedTeacher: null, updatedDate: new Date() },
    );
  }

  private async collectStudentLessonIds(
    manager: EntityManager,
    studentId: string,
  ): Promise<string[]> {
    const [directLessons, joinRows] = await Promise.all([
      manager.find(LessonEntity, {
        where: { studentId },
        select: ['id'],
      }),
      manager.find(LessonStudentEntity, {
        where: { studentId },
        select: ['lessonId'],
      }),
    ]);

    return [
      ...new Set([
        ...directLessons.map((row) => row.id),
        ...joinRows.map((row) => row.lessonId),
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

    await manager.delete(TeacherPaymentEntity, { lessonId: In(lessonIds) });
    await manager.delete(PaymentEntity, { lessonId: In(lessonIds) });
    await manager.delete(LessonStudentEntity, { lessonId: In(lessonIds) });
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
