import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TeacherAvailabilityService } from './teacher-availability.service';

type CheckAvailabilityBody = {
  date: string;
  start_time?: string;
  startTime?: string;
  duration?: number;
};

@Controller('schedule')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScheduleController {
  constructor(private readonly availability: TeacherAvailabilityService) {}

  @Get('teachers/:teacherId/availability')
  @Roles('admin', 'teacher')
  getTeacherAvailability(@Param('teacherId') teacherId: string) {
    return this.availability.getTeacherSchedule(teacherId);
  }

  @Post('teachers/:teacherId/check-availability')
  @Roles('admin', 'teacher')
  checkTeacherAvailability(
    @Param('teacherId') teacherId: string,
    @Body() body: CheckAvailabilityBody,
  ) {
    const startTime = body.start_time ?? body.startTime ?? '';
    return this.availability.checkAvailability(
      teacherId,
      body.date,
      startTime,
      Number(body.duration) || 60,
    );
  }
}
