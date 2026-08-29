import { Module } from '@nestjs/common';
import { LessonsModule } from '../lessons/lessons.module';
import { StudentsModule } from '../students/students.module';
import { TeachersModule } from '../teachers/teachers.module';
import { AdminDashboardService } from './admin-dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [TeachersModule, StudentsModule, LessonsModule],
  controllers: [DashboardController],
  providers: [AdminDashboardService],
})
export class DashboardModule {}
