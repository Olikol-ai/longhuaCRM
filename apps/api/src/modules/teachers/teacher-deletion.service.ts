import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull } from 'typeorm';
import { GroupEntity } from '../groups/entities/group.entity';
import { LessonSeriesEntity } from '../lesson-series/entities/lesson-series.entity';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { MaterialAccessEntity } from '../materials/entities/material-access.entity';
import { AvailabilityBookingEntity } from '../schedule/entities/availability-booking.entity';
import { AvailabilitySlotEntity } from '../schedule/entities/availability-slot.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherMonthlyPayoutEntity } from '../teacher-payments/entities/teacher-monthly-payout.entity';
import { TeacherPaymentEntity } from '../teacher-payments/entities/teacher-payment.entity';
import { UserEntity } from '../users/entities/user.entity';
import { TeacherEntity } from './entities/teacher.entity';
import { TeacherInviteLinkEntity } from './entities/teacher-invite-link.entity';

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

  /**
   * Remove a teacher profile and non-financial operational links.
   * Financial history (teacher_payments / monthly payouts) is preserved with
   * teacher_id set to NULL — UI shows "Удалённый преподаватель".
   */
  async deleteTeacher(teacherId: string): Promise<TeacherDeleteResult> {
    await this.dataSource.transaction(async (manager) => {
      const teacher = await manager.findOne(TeacherEntity, {
        where: { id: teacherId },
      });
      if (!teacher) {
        throw new NotFoundException('Teacher not found');
      }

      const linkedUserId = teacher.userId;

      // Operational links — detach or delete.
      await manager.update(LessonEntity, { teacherId }, { teacherId: null });
      await manager.update(LessonSeriesEntity, { teacherId }, { teacherId: null });
      await manager.update(GroupEntity, { teacherId }, { teacherId: null });
      await manager.update(
        StudentEntity,
        { assignedTeacherId: teacherId },
        { assignedTeacherId: null },
      );

      // Financial history — keep rows, clear teacher FK only.
      await manager.update(TeacherPaymentEntity, { teacherId }, { teacherId: null });
      await manager.update(
        TeacherMonthlyPayoutEntity,
        { teacherId },
        { teacherId: null },
      );

      await manager.delete(AvailabilitySlotEntity, { teacherId });
      await manager.delete(AvailabilityBookingEntity, { teacherId });
      await manager.delete(TeacherInviteLinkEntity, { teacherId });

      if (linkedUserId) {
        await manager.delete(MaterialAccessEntity, { userId: linkedUserId });
        // Clear telegram / auth linkage fields before user soft-block or hard delete.
        await manager.update(
          UserEntity,
          { id: linkedUserId },
          {
            status: 'blocked',
            role: '',
            telegramId: '',
            telegramUsername: '',
            telegramConnectedAt: null,
            telegramLinkToken: null,
            telegramLinkExpires: null,
            updatedDate: new Date(),
          },
        );
      }

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
