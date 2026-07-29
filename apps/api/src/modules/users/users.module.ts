import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentEntity } from '../students/entities/student.entity';
import { StudentsModule } from '../students/students.module';
import { TeachersModule } from '../teachers/teachers.module';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { TutorsModule } from '../tutors/tutors.module';
import { TutorEntity } from '../tutors/entities/tutor.entity';
import { TutorStudentEntity } from '../tutors/entities/tutor-student.entity';
import { MaterialAccessEntity } from '../materials/entities/material-access.entity';
import { UserEntity } from './entities/user.entity';
import { ProfileRelationsService } from './profile-relations.service';
import { RoleEntitySyncService } from './role-entity-sync.service';
import { UserProfileService } from './user-profile.service';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';
import { AvatarController } from './avatar/avatar.controller';
import { AvatarService } from './avatar/avatar.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      StudentEntity,
      TeacherEntity,
      TutorEntity,
      TutorStudentEntity,
      MaterialAccessEntity,
    ]),
    forwardRef(() => TeachersModule),
    forwardRef(() => TutorsModule),
    forwardRef(() => StudentsModule),
  ],
  controllers: [AvatarController, UsersController],
  providers: [
    UsersRepository,
    UsersService,
    RoleEntitySyncService,
    ProfileRelationsService,
    UserProfileService,
    AvatarService,
  ],
  exports: [
    UsersRepository,
    UsersService,
    RoleEntitySyncService,
    ProfileRelationsService,
    UserProfileService,
    AvatarService,
    TypeOrmModule,
  ],
})
export class UsersModule {}
