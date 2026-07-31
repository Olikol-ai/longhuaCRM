import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseTemplateEntity } from '../courses/entities/course-template.entity';
import { EnrollmentEntity } from '../courses/entities/enrollment.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { TutorEntity } from '../tutors/entities/tutor.entity';
import { TutorStudentEntity } from '../tutors/entities/tutor-student.entity';
import {
  ChatDirectPairEntity,
  ChatEntity,
  ChatMemberEntity,
  CourseSubjectEntity,
  SubjectEntity,
  TeacherSubjectEntity,
  TutorSubjectEntity,
  UserSubjectEntity,
} from './entities';
import { ChatMembershipSyncService } from './services/chat-membership-sync.service';

/**
 * Isolated membership sync (subjects / school / course / direct).
 * Kept free of AuthModule to avoid circular imports with Users → Teachers/Students.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatEntity,
      ChatMemberEntity,
      ChatDirectPairEntity,
      SubjectEntity,
      UserSubjectEntity,
      CourseSubjectEntity,
      TeacherSubjectEntity,
      TutorSubjectEntity,
      StudentEntity,
      TeacherEntity,
      TutorEntity,
      TutorStudentEntity,
      EnrollmentEntity,
      CourseTemplateEntity,
    ]),
  ],
  providers: [ChatMembershipSyncService],
  exports: [ChatMembershipSyncService, TypeOrmModule],
})
export class ChatMembershipModule {}
