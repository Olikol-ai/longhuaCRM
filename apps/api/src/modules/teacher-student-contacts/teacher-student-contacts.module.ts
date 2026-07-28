import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherStudentContactEntity } from './entities/teacher-student-contact.entity';
import { TeacherStudentContactsController } from './teacher-student-contacts.controller';
import { TeacherStudentContactsService } from './teacher-student-contacts.service';

@Module({
  imports: [TypeOrmModule.forFeature([TeacherStudentContactEntity])],
  controllers: [TeacherStudentContactsController],
  providers: [TeacherStudentContactsService],
  exports: [TeacherStudentContactsService, TypeOrmModule],
})
export class TeacherStudentContactsModule {}
