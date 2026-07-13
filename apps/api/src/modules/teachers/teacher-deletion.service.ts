import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull } from 'typeorm';
import { GroupEntity } from '../groups/entities/group.entity';
import { LessonSeriesEntity } from '../lesson-series/entities/lesson-series.entity';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { AvailabilityBookingEntity } from '../schedule/entities/availability-booking.entity';
import { AvailabilitySlotEntity } from '../schedule/entities/availability-slot.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherPaymentEntity } from '../teacher-payments/entities/teacher-payment.entity';
import { TeacherEntity } from './entities/teacher.entity';

export interface OrphanStudentRecord {
  id: string;
  name: string;
  email: string | null;
}

export interface TeacherDeleteResult {
  orphanStudents: OrphanStudentRecord[];
}

@Injectable()
export class TeacherDeletionService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async deleteTeacher(teacherId: string): Promise<TeacherDeleteResult> {
    await this.dataSource.transaction(async (manager) => {
      const teacher = await manager.findOne(TeacherEntity, {
        where: { id: teacherId },
      });
      if (!teacher) {
        throw new NotFoundException('Teacher not found');
      }

      await manager.update(LessonEntity, { teacherId }, { teacherId: null });
      await manager.update(LessonSeriesEntity, { teacherId }, { teacherId: null });
      await manager.update(GroupEntity, { teacherId }, { teacherId: null });
      await manager.update(
        StudentEntity,
        { assignedTeacherId: teacherId },
        { assignedTeacherId: null },
      );
      await manager.update(TeacherPaymentEntity, { teacherId }, { teacherId: null });
      await manager.delete(AvailabilitySlotEntity, { teacherId });
      await manager.delete(AvailabilityBookingEntity, { teacherId });
      await manager.delete(TeacherEntity, { id: teacherId });
    });

    return { orphanStudents: await this.findOrphanStudents() };
  }

  private async findOrphanStudents(): Promise<OrphanStudentRecord[]> {
    const rows = await this.dataSource.getRepository(StudentEntity).find({
      where: {
        assignedTeacherId: IsNull(),
        status: 'active',
      },
      order: { name: 'ASC' },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email ?? null,
    }));
  }
}
