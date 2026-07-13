import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseTemplateEntity } from '../courses/entities/course-template.entity';
import { GroupEntity } from '../groups/entities/group.entity';
import { LessonsModule } from '../lessons/lessons.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { LessonSeriesEntity } from './entities/lesson-series.entity';
import { LessonSeriesSlotEntity } from './entities/lesson-series-slot.entity';
import { LessonSeriesController } from './lesson-series.controller';
import { LessonSeriesRepository } from './lesson-series.repository';
import { LessonSeriesService } from './lesson-series.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LessonSeriesEntity,
      LessonSeriesSlotEntity,
      TeacherEntity,
      GroupEntity,
      CourseTemplateEntity,
    ]),
    LessonsModule,
    ScheduleModule,
  ],
  controllers: [LessonSeriesController],
  providers: [LessonSeriesRepository, LessonSeriesService],
  exports: [LessonSeriesRepository, LessonSeriesService, TypeOrmModule],
})
export class LessonSeriesModule {}
