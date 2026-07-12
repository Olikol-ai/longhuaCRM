import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonMaterialTagEntity } from '../../entities/lesson-material-tag.entity';
import { CourseEntity } from '../../entities/course.entity';
import { CourseFolderEntity } from '../../entities/course-folder.entity';
import { LessonMaterialEntity } from '../../entities/lesson-material.entity';
import { LessonEntity } from '../../entities/lesson.entity';
import { LessonMaterialLinkEntity } from '../../entities/lesson-material-link.entity';
import { LessonSeriesEntity } from '../../entities/lesson-series.entity';
import { LessonSeriesExclusionEntity } from '../../entities/lesson-series-exclusion.entity';
import { LessonSeriesStudentEntity } from '../../entities/lesson-series-student.entity';
import { LessonStudentEntity } from '../../entities/lesson-student.entity';
import { StudentEntity } from '../../entities/student.entity';
import { TeacherEntity } from '../../entities/teacher.entity';
import { TeacherAvailabilityBookingEntity } from '../../entities/teacher-availability-booking.entity';
import { TeacherAvailabilitySlotEntity } from '../../entities/teacher-availability-slot.entity';
import { StudentsModule } from '../students/students.module';
import { EntityEnrichmentService } from './entity-enrichment.service';
import { LessonOrchestratorService } from './lesson-orchestrator.service';
import { LessonRepositoryService } from './lesson-repository.service';
import { LessonSeriesOrchestratorService } from './lesson-series-orchestrator.service';
import { LessonSeriesService } from './lesson-series.service';
import { ScheduleOrchestratorService } from './schedule-orchestrator.service';
import { CourseFolderService } from './course-folder.service';
import { ScheduleController } from './schedule.controller';
import { TeacherAvailabilityBookingService } from './teacher-availability-booking.service';
import { TeacherAvailabilityService } from './teacher-availability.service';

@Module({
  imports: [
    StudentsModule,
    TypeOrmModule.forFeature([
      TeacherAvailabilityBookingEntity,
      TeacherAvailabilitySlotEntity,
      LessonEntity,
      LessonStudentEntity,
      LessonMaterialLinkEntity,
      LessonSeriesEntity,
      LessonSeriesStudentEntity,
      LessonSeriesExclusionEntity,
      LessonMaterialTagEntity,
      CourseFolderEntity,
      CourseEntity,
      LessonMaterialEntity,
      StudentEntity,
      TeacherEntity,
    ]),
  ],
  controllers: [ScheduleController],
  providers: [
    LessonRepositoryService,
    EntityEnrichmentService,
    LessonOrchestratorService,
    LessonSeriesOrchestratorService,
    ScheduleOrchestratorService,
    CourseFolderService,
    TeacherAvailabilityService,
    TeacherAvailabilityBookingService,
    LessonSeriesService,
  ],
  exports: [
    LessonRepositoryService,
    EntityEnrichmentService,
    LessonOrchestratorService,
    LessonSeriesOrchestratorService,
    ScheduleOrchestratorService,
    CourseFolderService,
    TeacherAvailabilityService,
    TeacherAvailabilityBookingService,
    LessonSeriesService,
  ],
})
export class ScheduleModule {}
