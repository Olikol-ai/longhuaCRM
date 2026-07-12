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
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
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
  findAllSlots() {
    return this.scheduleService.findAllSlots();
  }

  @Post('filter')
  filterSlots(@Body() dto: FilterQueryDto) {
    return this.scheduleService.filterSlots(dto.where ?? {});
  }

  @Post('bookings/filter')
  filterBookings(@Body() dto: FilterQueryDto) {
    return this.scheduleService.filterBookings(dto.where ?? {});
  }

  @Get('teachers/:teacherId/availability')
  @Roles('admin', 'teacher')
  getTeacherAvailability(@Param('teacherId') teacherId: string) {
    return this.scheduleService.getTeacherSchedule(teacherId);
  }

  @Post('teachers/:teacherId/check-availability')
  @Roles('admin', 'teacher')
  checkTeacherAvailability(
    @Param('teacherId') teacherId: string,
    @Body() body: CheckAvailabilityDto,
  ) {
    const startTime = body.start_time ?? body.startTime ?? '';
    return this.scheduleService.checkAvailability(
      teacherId,
      body.date,
      startTime,
      Number(body.duration) || 60,
    );
  }

  @Get(':id')
  findSlotById(@Param('id') id: string) {
    return this.scheduleService.findSlotById(id);
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
