import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherEntity } from './entities/teacher.entity';
import { TeachersController } from './teachers.controller';
import { TeachersRepository } from './teachers.repository';
import { TeachersService } from './teachers.service';

@Module({
  imports: [TypeOrmModule.forFeature([TeacherEntity])],
  controllers: [TeachersController],
  providers: [TeachersRepository, TeachersService],
  exports: [TeachersRepository, TeachersService, TypeOrmModule],
})
export class TeachersModule {}
