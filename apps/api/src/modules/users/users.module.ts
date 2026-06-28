import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserEntity } from '../../entities/user.entity';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  controllers: [UsersController],
  providers: [UsersRepository, RolesGuard],
  exports: [UsersRepository, TypeOrmModule],
})
export class UsersModule {}
