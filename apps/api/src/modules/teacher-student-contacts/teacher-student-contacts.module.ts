import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherStudentBalanceHistoryEntity } from './entities/teacher-student-balance-history.entity';
import { TeacherStudentContactEntity } from './entities/teacher-student-contact.entity';
import { TeacherStudentContactBalanceService } from './teacher-student-contact-balance.service';
import { TeacherStudentContactsController } from './teacher-student-contacts.controller';
import { TeacherStudentContactsService } from './teacher-student-contacts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TeacherStudentContactEntity,
      TeacherStudentBalanceHistoryEntity,
    ]),
  ],
  controllers: [TeacherStudentContactsController],
  providers: [TeacherStudentContactsService, TeacherStudentContactBalanceService],
  exports: [
    TeacherStudentContactsService,
    TeacherStudentContactBalanceService,
    TypeOrmModule,
  ],
})
export class TeacherStudentContactsModule {}
