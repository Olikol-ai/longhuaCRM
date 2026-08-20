import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/auth.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { CreateRecurringLessonDto } from './dto/lesson-recurrence.dto';
import { FilterQueryDto } from './dto/filter-query.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { UpdateLessonStudentsDto } from './dto/update-lesson-students.dto';
import { LessonRecurrenceService } from './lesson-recurrence.service';
import { LessonsService } from './lessons.service';

@Controller('lessons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LessonsController {
  constructor(
    private readonly lessonsService: LessonsService,
    private readonly recurrence: LessonRecurrenceService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.lessonsService.findAll(user);
  }

  @Post('filter')
  filter(@CurrentUser() user: JwtPayload, @Body() dto: FilterQueryDto) {
    return this.lessonsService.filter(user, dto.where ?? {});
  }

  @Get('attendance')
  findAllAttendance(@CurrentUser() user: JwtPayload) {
    return this.lessonsService.findAllAttendance(user);
  }

  @Post('attendance/filter')
  filterAttendance(@CurrentUser() user: JwtPayload, @Body() dto: FilterQueryDto) {
    return this.lessonsService.filterAttendance(user, dto.where ?? {});
  }

  @Get('attendance/:id')
  findAttendanceById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.lessonsService.findAttendanceById(user, id);
  }

  @Post('attendance')
  @Roles('admin')
  createAttendance(@Body() dto: CreateAttendanceDto) {
    return this.lessonsService.createAttendance(dto);
  }

  @Patch('attendance/:id')
  @Roles('admin', 'teacher', 'tutor')
  updateAttendance(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAttendanceDto,
  ) {
    return this.lessonsService.updateAttendance(user, id, dto);
  }

  @Patch('attendance/:id/present')
  @Roles('admin', 'teacher', 'tutor')
  markPresent(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.lessonsService.markPresent(user, id);
  }

  @Patch('attendance/:id/absent')
  @Roles('admin', 'teacher', 'tutor')
  markAbsent(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.lessonsService.markAbsent(user, id);
  }

  @Patch('attendance/:id/late')
  @Roles('admin', 'teacher', 'tutor')
  markLate(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.lessonsService.markLate(user, id);
  }

  @Patch('attendance/:id/excused')
  @Roles('admin', 'teacher', 'tutor')
  markExcused(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.lessonsService.markExcused(user, id);
  }

  @Delete('attendance/:id')
  @Roles('admin')
  deleteAttendance(@Param('id') id: string) {
    return this.lessonsService.deleteAttendance(id);
  }

  @Patch(':id/complete')
  @Roles('admin', 'teacher', 'tutor')
  complete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.lessonsService.complete(user, id);
  }

  @Patch(':id/cancel')
  @Roles('admin', 'teacher', 'tutor')
  cancel(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.lessonsService.cancel(user, id);
  }

  @Patch(':id/students')
  @Roles('admin', 'teacher', 'tutor')
  updateStudents(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateLessonStudentsDto,
  ) {
    return this.lessonsService.updateStudents(user, id, dto);
  }

  @Get(':id/student-changes')
  @Roles('admin', 'teacher', 'tutor')
  listStudentChanges(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.lessonsService.listStudentChanges(user, id);
  }

  @Post('recurring')
  @Roles('admin', 'teacher', 'tutor')
  createRecurring(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateRecurringLessonDto,
  ) {
    return this.recurrence.createWeeklySeries(user, dto);
  }

  @Get(':id')
  findById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.lessonsService.findById(user, id);
  }

  @Post()
  @Roles('admin', 'teacher', 'tutor')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateLessonDto) {
    return this.lessonsService.create(user, dto);
  }

  @Patch(':id')
  @Roles('admin', 'teacher', 'tutor')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateLessonDto,
  ) {
    const {
      recurrenceWeekly,
      recurrenceUntil,
      applyScope,
      ...lessonPatch
    } = dto;

    // Status + apply_scope goes through recurrence so series cancel can fan out.
    // Cancel without scope (or apply_scope=this) stays exact-id cancel.
    if (
      lessonPatch.status !== undefined &&
      (recurrenceWeekly !== undefined ||
        recurrenceUntil !== undefined ||
        applyScope !== undefined)
    ) {
      return this.recurrence.applyLessonUpdateWithRecurrence(
        user,
        id,
        lessonPatch,
        {
          weekly: recurrenceWeekly,
          untilDate: recurrenceUntil,
          applyScope,
        },
      );
    }

    if (lessonPatch.status === 'cancelled') {
      return this.lessonsService.cancel(user, id);
    }

    if (
      recurrenceWeekly !== undefined ||
      recurrenceUntil !== undefined ||
      applyScope !== undefined
    ) {
      return this.recurrence.applyLessonUpdateWithRecurrence(
        user,
        id,
        lessonPatch,
        {
          weekly: recurrenceWeekly,
          untilDate: recurrenceUntil,
          applyScope,
        },
      );
    }
    return this.lessonsService.update(user, id, lessonPatch);
  }

  @Delete(':id')
  @Roles('admin', 'teacher', 'tutor')
  delete(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('applyScope') applyScope?: string,
    @Query('apply_scope') applyScopeSnake?: string,
  ) {
    return this.lessonsService.deleteWithScope(
      user,
      id,
      applyScope ?? applyScopeSnake,
    );
  }
}
