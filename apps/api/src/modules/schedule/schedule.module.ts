import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonMaterialTagEntity } from '../../entities/LessonMaterialTag.entity';
import { CourseEntity } from '../../entities/Course.entity';
import { CourseFolderEntity } from '../../entities/CourseFolder.entity';
import { LessonMaterialEntity } from '../../entities/LessonMaterial.entity';
import { LessonEntity } from '../../entities/Lesson.entity';
import { LessonMaterialLinkEntity } from '../../entities/LessonMaterialLink.entity';
import { LessonSeriesEntity } from '../../entities/LessonSeries.entity';
import { LessonSeriesExclusionEntity } from '../../entities/LessonSeriesExclusion.entity';
import { LessonSeriesStudentEntity } from '../../entities/LessonSeriesStudent.entity';
import { LessonStudentEntity } from '../../entities/LessonStudent.entity';
import { StudentEntity } from '../../entities/Student.entity';
import { TeacherEntity } from '../../entities/Teacher.entity';
import { TeacherAvailabilityBookingEntity } from '../../entities/TeacherAvailabilityBooking.entity';
import { TeacherAvailabilitySlotEntity } from '../../entities/TeacherAvailabilitySlot.entity';
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
