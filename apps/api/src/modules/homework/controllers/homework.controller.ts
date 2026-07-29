import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { JwtPayload } from '../../auth/auth.service';
import {
  AssignHomeworkDto,
  CreateHomeworkDto,
  SaveHomeworkAnswersDto,
  SubmitHomeworkDto,
  UpdateHomeworkDto,
  UpdateLocalHomeworkStatusDto,
} from '../dto/homework.dto';
import { HomeworkService } from '../services/homework.service';

@Controller('homework')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HomeworkController {
  constructor(private readonly homework: HomeworkService) {}

  @Get()
  @Roles('admin', 'teacher', 'tutor')
  list(@CurrentUser() user: JwtPayload) {
    return this.homework.listForTeacher(user);
  }

  @Post()
  @Roles('admin', 'teacher', 'tutor')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateHomeworkDto) {
    return this.homework.create(user, dto);
  }

  @Get('assignments/mine')
  @Roles('admin', 'student', 'tutor_student')
  myAssignments(@CurrentUser() user: JwtPayload) {
    return this.homework.listMyAssignments(user);
  }

  @Get('assignments')
  @Roles('admin', 'teacher', 'tutor')
  teacherAssignments(
    @CurrentUser() user: JwtPayload,
    @Query('homeworkId') homeworkId?: string,
  ) {
    return this.homework.listAssignmentsForTeacher(user, homeworkId);
  }

  @Get('assignments/:id/result')
  @Roles('admin', 'teacher', 'tutor')
  assignmentResult(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.homework.getResultForTeacher(user, id);
  }

  @Post('assignments/:id/start')
  @Roles('admin', 'student', 'tutor_student')
  start(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.homework.startAttempt(user, id);
  }

  @Get('attempts/:id')
  @Roles('admin', 'teacher', 'tutor', 'student', 'tutor_student')
  attemptState(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.homework.getAttemptState(user, id);
  }

  @Patch('attempts/:id/answers')
  @Roles('admin', 'student', 'tutor_student')
  saveAnswers(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveHomeworkAnswersDto,
  ) {
    return this.homework.saveAnswers(user, id, dto.answers);
  }

  @Post('attempts/:id/submit')
  @Roles('admin', 'student', 'tutor_student')
  submit(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitHomeworkDto,
  ) {
    return this.homework.submit(user, id, dto.answers);
  }

  @Get(':id')
  @Roles('admin', 'teacher', 'tutor', 'student')
  get(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.homework.getHomework(user, id);
  }

  @Patch(':id')
  @Roles('admin', 'teacher', 'tutor')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHomeworkDto,
  ) {
    return this.homework.update(user, id, dto);
  }

  @Post(':id/publish')
  @Roles('admin', 'teacher', 'tutor')
  publish(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.homework.publish(user, id);
  }

  @Post(':id/assign')
  @Roles('admin', 'teacher', 'tutor')
  assign(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignHomeworkDto,
  ) {
    return this.homework.assign(user, id, dto);
  }

  @Patch('assignments/:id/local-status')
  @Roles('admin', 'teacher', 'tutor')
  updateLocalStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLocalHomeworkStatusDto,
  ) {
    return this.homework.updateLocalAssignmentStatus(user, id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'teacher', 'tutor')
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.homework.delete(user, id);
  }
}
