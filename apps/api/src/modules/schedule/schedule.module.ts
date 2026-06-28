import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonMaterialTagEntity } from '../../entities/LessonMaterialTag.entity';
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
import { TeacherAvailabilityBookingService } from './teacher-availability-booking.service';

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
      StudentEntity,
      TeacherEntity,
    ]),
  ],
  providers: [
    LessonRepositoryService,
    EntityEnrichmentService,
    LessonOrchestratorService,
    LessonSeriesOrchestratorService,
    ScheduleOrchestratorService,
    TeacherAvailabilityBookingService,
    LessonSeriesService,
  ],
  exports: [
    LessonRepositoryService,
    EntityEnrichmentService,
    LessonOrchestratorService,
    LessonSeriesOrchestratorService,
    ScheduleOrchestratorService,
    TeacherAvailabilityBookingService,
    LessonSeriesService,
  ],
})
export class ScheduleModule {}
