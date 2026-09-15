import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { ChatMembershipModule } from '../chats/chat-membership.module';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { TutorEntity } from '../tutors/entities/tutor.entity';
import { TeacherStudentContactsModule } from '../teacher-student-contacts/teacher-student-contacts.module';
import { StudentEntity } from './entities/student.entity';
import { StudentsController } from './students.controller';
import { StudentDeletionService } from './student-deletion.service';
import { StudentMergeService } from './student-merge.service';
import { StudentsRepository } from './students.repository';
import { StudentsService } from './students.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StudentEntity, TeacherEntity, TutorEntity]),
    AuditModule,
    forwardRef(() => UsersModule),
    ChatMembershipModule,
    TeacherStudentContactsModule,
  ],
  controllers: [StudentsController],
  providers: [StudentsRepository, StudentsService, StudentDeletionService, StudentMergeService],
  exports: [StudentsRepository, StudentsService, StudentDeletionService, StudentMergeService, TypeOrmModule],
})
export class StudentsModule {}
