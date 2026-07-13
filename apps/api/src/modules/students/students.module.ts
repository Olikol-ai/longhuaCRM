import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentEntity } from './entities/student.entity';
import { StudentsController } from './students.controller';
import { StudentDeletionService } from './student-deletion.service';
import { StudentsRepository } from './students.repository';
import { StudentsService } from './students.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([StudentEntity]), forwardRef(() => UsersModule)],
  controllers: [StudentsController],
  providers: [StudentsRepository, StudentsService, StudentDeletionService],
  exports: [StudentsRepository, StudentsService, StudentDeletionService, TypeOrmModule],
})
export class StudentsModule {}
