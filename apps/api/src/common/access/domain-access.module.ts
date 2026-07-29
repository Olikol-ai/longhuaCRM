import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CertificateEntity } from '../../modules/certificates/entities/certificate.entity';
import { CourseTemplateEntity } from '../../modules/courses/entities/course-template.entity';
import { EnrollmentEntity } from '../../modules/courses/entities/enrollment.entity';
import { GroupEntity } from '../../modules/groups/entities/group.entity';
import { GroupMemberEntity } from '../../modules/groups/entities/group-member.entity';
import { AttendanceEntity } from '../../modules/lessons/entities/attendance.entity';
import { LessonEntity } from '../../modules/lessons/entities/lesson.entity';
import { MaterialAccessEntity } from '../../modules/materials/entities/material-access.entity';
import { MaterialCourseGrantEntity } from '../../modules/materials/entities/material-course-grant.entity';
import { MaterialGroupGrantEntity } from '../../modules/materials/entities/material-group-grant.entity';
import { MaterialFolderEntity } from '../../modules/materials/entities/material-folder.entity';
import { MaterialEntity } from '../../modules/materials/entities/material.entity';
import { StudentEntity } from '../../modules/students/entities/student.entity';
import { TeacherEntity } from '../../modules/teachers/entities/teacher.entity';
import { TeacherStudentContactEntity } from '../../modules/teacher-student-contacts/entities/teacher-student-contact.entity';
import { TutorEntity } from '../../modules/tutors/entities/tutor.entity';
import { TutorStudentEntity } from '../../modules/tutors/entities/tutor-student.entity';
import {
  AssessmentAttemptEntity,
  AssessmentExamAssignmentEntity,
  AssessmentExamEntity,
  AssessmentResultEntity,
} from '../../modules/assessment/entities';
import { CertificateAccessService } from './certificate-access.service';
import { CourseAccessService } from './course-access.service';
import { LessonAccessService } from './lesson-access.service';
import { MaterialsDomainAccessService } from './materials-domain-access.service';
import { ScheduleAccessService } from './schedule-access.service';
import { StudentAccessService } from './student-access.service';
import { TeacherAccessService } from './teacher-access.service';
import { TeacherStudentContactAccessService } from './teacher-student-contact-access.service';
import { TutorAccessService } from './tutor-access.service';
import { TutorStudentAccessService } from './tutor-student-access.service';
import { AssessmentAccessService } from './assessment-access.service';
import { ChatAccessService } from './chat-access.service';
import { ChatPrivacyService } from './chat-privacy.service';
import { ChatEntity, ChatMemberEntity, ChatDirectPairEntity, DirectChatRequestEntity, UserPrivacySettingsEntity, UserBlockEntity } from '../../modules/chats/entities';
import { UserEntity } from '../../modules/users/entities/user.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudentEntity,
      TeacherEntity,
      TutorEntity,
      TutorStudentEntity,
      TeacherStudentContactEntity,
      LessonEntity,
      AttendanceEntity,
      GroupEntity,
      GroupMemberEntity,
      EnrollmentEntity,
      CourseTemplateEntity,
      MaterialEntity,
      MaterialFolderEntity,
      MaterialAccessEntity,
      MaterialCourseGrantEntity,
      MaterialGroupGrantEntity,
      CertificateEntity,
      AssessmentExamEntity,
      AssessmentExamAssignmentEntity,
      AssessmentAttemptEntity,
      AssessmentResultEntity,
      ChatEntity,
      ChatMemberEntity,
      ChatDirectPairEntity,
      DirectChatRequestEntity,
      UserPrivacySettingsEntity,
      UserBlockEntity,
      UserEntity,
    ]),
  ],
  providers: [
    StudentAccessService,
    TeacherAccessService,
    TutorAccessService,
    TutorStudentAccessService,
    TeacherStudentContactAccessService,
    LessonAccessService,
    ScheduleAccessService,
    CourseAccessService,
    MaterialsDomainAccessService,
    CertificateAccessService,
    AssessmentAccessService,
    ChatPrivacyService,
    ChatAccessService,
  ],
  exports: [
    StudentAccessService,
    TeacherAccessService,
    TutorAccessService,
    TutorStudentAccessService,
    TeacherStudentContactAccessService,
    LessonAccessService,
    ScheduleAccessService,
    CourseAccessService,
    MaterialsDomainAccessService,
    CertificateAccessService,
    AssessmentAccessService,
    ChatPrivacyService,
    ChatAccessService,
  ],
})
export class DomainAccessModule {}
