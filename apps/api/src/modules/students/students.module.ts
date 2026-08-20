import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatMembershipModule } from '../chats/chat-membership.module';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { TeacherStudentContactsModule } from '../teacher-student-contacts/teacher-student-contacts.module';
import { StudentEntity } from './entities/student.entity';
import { StudentsController } from './students.controller';
import { StudentDeletionService } from './student-deletion.service';
import { StudentsRepository } from './students.repository';
import { StudentsService } from './students.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StudentEntity, TeacherEntity]),
    forwardRef(() => UsersModule),
    ChatMembershipModule,
    TeacherStudentContactsModule,
  ],
  controllers: [StudentsController],
  providers: [StudentsRepository, StudentsService, StudentDeletionService],
  exports: [StudentsRepository, StudentsService, StudentDeletionService, TypeOrmModule],
})
export class StudentsModule {}
