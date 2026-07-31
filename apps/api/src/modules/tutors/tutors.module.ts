import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatMembershipModule } from '../chats/chat-membership.module';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { UserEntity } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { TutorEntity } from './entities/tutor.entity';
import { TutorInviteLinkEntity } from './entities/tutor-invite-link.entity';
import { TutorLearningDirectionEntity } from './entities/tutor-learning-direction.entity';
import { TutorLessonDurationEntity } from './entities/tutor-lesson-duration.entity';
import { TutorMaterialEntity } from './entities/tutor-material.entity';
import { TutorStudentEntity } from './entities/tutor-student.entity';
import { TutorTeachingLanguageEntity } from './entities/tutor-teaching-language.entity';
import { TutorWorkDayEntity } from './entities/tutor-work-day.entity';
import { TutorDeletionService } from './tutor-deletion.service';
import { TutorInvitesController } from './tutor-invites.controller';
import { TutorInvitesService } from './tutor-invites.service';
import { TutorsController } from './tutors.controller';
import { TutorsRepository } from './tutors.repository';
import { TutorsService } from './tutors.service';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    ChatMembershipModule,
    TypeOrmModule.forFeature([
      TutorEntity,
      TutorStudentEntity,
      TutorInviteLinkEntity,
      TutorLearningDirectionEntity,
      TutorTeachingLanguageEntity,
      TutorLessonDurationEntity,
      TutorWorkDayEntity,
      TutorMaterialEntity,
      UserEntity,
      StudentEntity,
      LessonEntity,
    ]),
  ],
  controllers: [TutorsController, TutorInvitesController],
  providers: [
    TutorsRepository,
    TutorsService,
    TutorDeletionService,
    TutorInvitesService,
  ],
  exports: [
    TutorsRepository,
    TutorsService,
    TutorDeletionService,
    TutorInvitesService,
    TypeOrmModule,
  ],
})
export class TutorsModule {}
