import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { MaterialAccessEntity } from '../materials/entities/material-access.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { UserEntity } from '../users/entities/user.entity';
import { TutorEntity } from './entities/tutor.entity';

export interface TutorDeleteResult {
  ok: true;
}

/**
 * Delete tutor profile while preserving lesson history (tutor_id → NULL).
 * No finance tables yet — when added, they must also SET NULL, not CASCADE delete.
 */
@Injectable()
export class TutorDeletionService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async deleteTutor(tutorId: string): Promise<TutorDeleteResult> {
    await this.dataSource.transaction(async (manager) => {
      const tutor = await manager.findOne(TutorEntity, { where: { id: tutorId } });
      if (!tutor) {
        throw new NotFoundException('Tutor not found');
      }

      const linkedUserId = tutor.userId;

      await manager.update(LessonEntity, { tutorId }, { tutorId: null });
      await manager.update(
        StudentEntity,
        { assignedTutorId: tutorId },
        { assignedTutorId: null },
      );

      if (linkedUserId) {
        await manager.delete(MaterialAccessEntity, { userId: linkedUserId });
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

      await manager.delete(TutorEntity, { id: tutorId });
    });

    return { ok: true };
  }
}
