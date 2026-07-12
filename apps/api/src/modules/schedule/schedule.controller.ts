import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/auth.service';
import { CheckAvailabilityDto } from './dto/check-availability.dto';
import { CreateAvailabilitySlotDto } from './dto/create-availability-slot.dto';
import { FilterQueryDto } from './dto/filter-query.dto';
import { UpdateAvailabilitySlotDto } from './dto/update-availability-slot.dto';
import { ScheduleService } from './schedule.service';

@Controller('schedule')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get()
  @Roles('admin', 'teacher')
  findAllSlots(@CurrentUser() user: JwtPayload) {
    return this.scheduleService.findAllSlots(user);
  }

  @Post('filter')
  @Roles('admin', 'teacher')
  filterSlots(@CurrentUser() user: JwtPayload, @Body() dto: FilterQueryDto) {
    return this.scheduleService.filterSlots(user, dto.where ?? {});
  }

  @Post('bookings/filter')
  @Roles('admin', 'teacher')
  filterBookings(@CurrentUser() user: JwtPayload, @Body() dto: FilterQueryDto) {
    return this.scheduleService.filterBookings(user, dto.where ?? {});
  }

  @Get('teachers/:teacherId/availability')
  @Roles('admin', 'teacher', 'student')
  getTeacherAvailability(
    @CurrentUser() user: JwtPayload,
    @Param('teacherId') teacherId: string,
  ) {
    return this.scheduleService.getTeacherSchedule(user, teacherId);
  }

  @Post('teachers/:teacherId/check-availability')
  @Roles('admin', 'teacher', 'student')
  checkTeacherAvailability(
    @CurrentUser() user: JwtPayload,
    @Param('teacherId') teacherId: string,
    @Body() body: CheckAvailabilityDto,
  ) {
    const startTime = body.start_time ?? body.startTime ?? '';
    return this.scheduleService.checkAvailability(
      user,
      teacherId,
      body.date,
      startTime,
      Number(body.duration) || 60,
    );
  }

  @Get(':id')
  @Roles('admin', 'teacher')
  findSlotById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.scheduleService.findSlotById(user, id);
  }

  @Post()
  @Roles('admin')
  createSlot(@Body() dto: CreateAvailabilitySlotDto) {
    return this.scheduleService.createSlot(dto);
  }

  @Patch(':id')
  @Roles('admin')
  updateSlot(@Param('id') id: string, @Body() dto: UpdateAvailabilitySlotDto) {
    return this.scheduleService.updateSlot(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  deleteSlot(@Param('id') id: string) {
    return this.scheduleService.deleteSlot(id);
  }
}
