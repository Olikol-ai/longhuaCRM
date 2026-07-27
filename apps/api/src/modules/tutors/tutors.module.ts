import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { UserEntity } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { TutorEntity } from './entities/tutor.entity';
import { TutorDeletionService } from './tutor-deletion.service';
import { TutorsController } from './tutors.controller';
import { TutorsRepository } from './tutors.repository';
import { TutorsService } from './tutors.service';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    TypeOrmModule.forFeature([TutorEntity, UserEntity, StudentEntity, LessonEntity]),
  ],
  controllers: [TutorsController],
  providers: [TutorsRepository, TutorsService, TutorDeletionService],
  exports: [
    TutorsRepository,
    TutorsService,
    TutorDeletionService,
    TypeOrmModule,
  ],
})
export class TutorsModule {}
