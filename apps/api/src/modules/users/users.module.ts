import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { UserEntity } from './entities/user.entity';
import { ProfileRelationsService } from './profile-relations.service';
import { RoleEntitySyncService } from './role-entity-sync.service';
import { UserProfileService } from './user-profile.service';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, StudentEntity, TeacherEntity])],
  controllers: [UsersController],
  providers: [
    UsersRepository,
    UsersService,
    RoleEntitySyncService,
    ProfileRelationsService,
    UserProfileService,
  ],
  exports: [
    UsersRepository,
    UsersService,
    RoleEntitySyncService,
    ProfileRelationsService,
    UserProfileService,
    TypeOrmModule,
  ],
})
export class UsersModule {}
