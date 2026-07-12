import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CertificateEntity } from '../../modules/certificates/entities/certificate.entity';
import { CourseTemplateEntity } from '../../modules/courses/entities/course-template.entity';
import { EnrollmentEntity } from '../../modules/courses/entities/enrollment.entity';
import { GroupEntity } from '../../modules/groups/entities/group.entity';
import { AttendanceEntity } from '../../modules/lessons/entities/attendance.entity';
import { LessonEntity } from '../../modules/lessons/entities/lesson.entity';
import { MaterialAccessEntity } from '../../modules/materials/entities/material-access.entity';
import { MaterialFolderEntity } from '../../modules/materials/entities/material-folder.entity';
import { MaterialEntity } from '../../modules/materials/entities/material.entity';
import { StudentEntity } from '../../modules/students/entities/student.entity';
import { TeacherEntity } from '../../modules/teachers/entities/teacher.entity';
import { CertificateAccessService } from './certificate-access.service';
import { CourseAccessService } from './course-access.service';
import { LessonAccessService } from './lesson-access.service';
import { MaterialsDomainAccessService } from './materials-domain-access.service';
import { ScheduleAccessService } from './schedule-access.service';
import { StudentAccessService } from './student-access.service';
import { TeacherAccessService } from './teacher-access.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudentEntity,
      TeacherEntity,
      LessonEntity,
      AttendanceEntity,
      GroupEntity,
      EnrollmentEntity,
      CourseTemplateEntity,
      MaterialEntity,
      MaterialFolderEntity,
      MaterialAccessEntity,
      CertificateEntity,
    ]),
  ],
  providers: [
    StudentAccessService,
    TeacherAccessService,
    LessonAccessService,
    ScheduleAccessService,
    CourseAccessService,
    MaterialsDomainAccessService,
    CertificateAccessService,
  ],
  exports: [
    StudentAccessService,
    TeacherAccessService,
    LessonAccessService,
    ScheduleAccessService,
    CourseAccessService,
    MaterialsDomainAccessService,
    CertificateAccessService,
  ],
})
export class DomainAccessModule {}
