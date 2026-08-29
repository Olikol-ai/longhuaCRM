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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { JwtPayload } from '../../auth/auth.service';
import {
  AssignHomeworkDto,
  CreateHomeworkDto,
  HomeworkAccessGrantDto,
  HomeworkAccessRevokeDto,
  SaveHomeworkAnswersDto,
  SaveHomeworkReviewDto,
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

  @Post('access/grant')
  @Roles('admin', 'teacher', 'tutor')
  grantAccess(@CurrentUser() user: JwtPayload, @Body() dto: HomeworkAccessGrantDto) {
    return this.homework.grantAccess(user, dto);
  }

  @Post('access/revoke')
  @Roles('admin', 'teacher', 'tutor')
  revokeAccess(@CurrentUser() user: JwtPayload, @Body() dto: HomeworkAccessRevokeDto) {
    return this.homework.revokeAccess(user, dto);
  }

  @Post('access/bulk-grant')
  @Roles('admin', 'teacher', 'tutor')
  bulkGrantAccess(@CurrentUser() user: JwtPayload, @Body() dto: HomeworkAccessGrantDto) {
    return this.homework.grantAccess(user, dto);
  }

  @Post('access/bulk-revoke')
  @Roles('admin', 'teacher', 'tutor')
  bulkRevokeAccess(@CurrentUser() user: JwtPayload, @Body() dto: HomeworkAccessRevokeDto) {
    return this.homework.revokeAccess(user, dto);
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

  @Patch('assignments/:id/review')
  @Roles('admin', 'teacher', 'tutor')
  saveReview(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveHomeworkReviewDto,
  ) {
    return this.homework.saveReview(user, id, dto);
  }

  @Post('assignments/:id/review/finalize')
  @Roles('admin', 'teacher', 'tutor')
  finalizeReview(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveHomeworkReviewDto,
  ) {
    return this.homework.finalizeReview(user, id, dto);
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

  @Post('attempts/:id/questions/:questionSnapshotId/audio')
  @Roles('admin', 'student', 'tutor_student')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  uploadSpeakingAudio(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('questionSnapshotId', ParseUUIDPipe) questionSnapshotId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('duration_ms') durationMsRaw?: string,
  ) {
    const durationMs =
      durationMsRaw != null && durationMsRaw !== ''
        ? Number(durationMsRaw)
        : null;
    return this.homework.uploadSpeakingAudio(
      user,
      id,
      questionSnapshotId,
      {
        buffer: file?.buffer,
        originalname: file?.originalname || 'answer.webm',
        mimetype: file?.mimetype,
        size: file?.size,
      },
      durationMs,
    );
  }

  @Get('attempts/:id/answers/:attemptAnswerId/audio')
  @Roles('admin', 'teacher', 'tutor', 'student', 'tutor_student')
  streamSpeakingAudio(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attemptAnswerId', ParseUUIDPipe) attemptAnswerId: string,
  ) {
    return this.homework.streamSpeakingAudio(user, id, attemptAnswerId);
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

  @Get(':id/access')
  @Roles('admin', 'teacher', 'tutor')
  listAccess(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.homework.listAccess(user, id);
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

  @Post('assignments/:id/cancel')
  @Roles('admin', 'teacher', 'tutor')
  cancelAssignment(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.homework.cancelAssignment(user, id);
  }

  @Delete(':id')
  @Roles('admin', 'teacher', 'tutor')
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.homework.delete(user, id);
  }
}
