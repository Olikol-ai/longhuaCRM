import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../common/guards/roles.guard';
import { StudentEntity } from '../../entities/Student.entity';
import { TeacherEntity } from '../../entities/Teacher.entity';
import { UserEntity } from '../../entities/user.entity';
import { RoleEntitySyncService } from './role-entity-sync.service';
import { UserProfileService } from './user-profile.service';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, StudentEntity, TeacherEntity])],
  controllers: [UsersController],
  providers: [UsersRepository, RoleEntitySyncService, UserProfileService, RolesGuard],
  exports: [UsersRepository, RoleEntitySyncService, UserProfileService, TypeOrmModule],
})
export class UsersModule {}
