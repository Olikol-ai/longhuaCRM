import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { JwtPayload } from '../../auth/auth.service';
import {
  AutosaveAnswersDto,
  ListAttemptsQueryDto,
  StartAttemptDto,
  SubmitAttemptDto,
  paginateArray,
} from '../dto';
import { SubmitReason } from '../enums';
import { AttemptService } from '../services/attempt.service';
import { ResultService } from '../services/result.service';

@ApiTags('Assessment Attempts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assessment/attempts')
export class AssessmentAttemptsController {
  constructor(
    private readonly attempts: AttemptService,
    private readonly results: ResultService,
  ) {}

  @Post()
  @Roles('student', 'teacher', 'tutor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start exam attempt' })
  @ApiResponse({ status: 201, description: 'Attempt started' })
  async start(@CurrentUser() user: JwtPayload, @Body() dto: StartAttemptDto) {
    const attempt = await this.attempts.startForUser(user, {
      examId: dto.exam_id,
      assignmentId: dto.assignment_id ?? null,
    });
    return this.attempts.getState(attempt.id, user);
  }

  @Get()
  @Roles('admin', 'teacher', 'tutor', 'student')
  @ApiOperation({ summary: 'List attempts' })
  @ApiResponse({ status: 200, description: 'Paginated attempt list' })
  async list(@CurrentUser() user: JwtPayload, @Query() query: ListAttemptsQueryDto) {
    const items = await this.attempts.listFiltered(
      {
        examId: query.exam_id,
        studentId: query.student_id,
        status: query.status,
      },
      user,
    );
    return paginateArray(items, query.limit, query.offset);
  }

  @Get(':attemptId/result')
  @Roles('admin', 'teacher', 'tutor', 'student')
  @ApiOperation({ summary: 'Get result by attempt id' })
  @ApiResponse({ status: 200, description: 'Result for attempt' })
  resultByAttempt(
    @CurrentUser() user: JwtPayload,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
  ) {
    return this.results.getByAttemptForActor(attemptId, user);
  }

  @Get(':attemptId/snapshots')
  @Roles('admin', 'teacher', 'tutor', 'student')
  @ApiOperation({ summary: 'Get immutable Attempt Snapshot set' })
  @ApiResponse({ status: 200, description: 'Question and answer snapshots' })
  getSnapshots(
    @CurrentUser() user: JwtPayload,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
  ) {
    return this.attempts.getSnapshots(attemptId, user);
  }

  @Patch(':attemptId/answers')
  @Roles('student', 'teacher', 'tutor')
  @ApiOperation({ summary: 'Autosave attempt answers' })
  @ApiResponse({ status: 200, description: 'Answers saved' })
  autosave(
    @CurrentUser() user: JwtPayload,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body() dto: AutosaveAnswersDto,
  ) {
    return this.attempts.autosaveAnswers({
      attemptId,
      userId: user.sub,
      role: user.role,
      actor: user,
      answers: dto.answers.map((answer) => {
        const selected =
          answer.selected_answer_ids ?? answer.selected_answer_snapshot_ids;
        const text = answer.text_answer !== undefined ? answer.text_answer : answer.text;
        return {
          questionSnapshotId: answer.question_snapshot_id,
          selectedAnswerSnapshotIds: selected,
          textAnswer: text ?? null,
          selectionsProvided: selected !== undefined,
          textProvided: answer.text_answer !== undefined || answer.text !== undefined,
        };
      }),
    });
  }

  @Get(':attemptId')
  @Roles('admin', 'teacher', 'tutor', 'student')
  @ApiOperation({ summary: 'Get attempt state' })
  @ApiResponse({ status: 200, description: 'Attempt state' })
  getState(
    @CurrentUser() user: JwtPayload,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
  ) {
    return this.attempts.getState(attemptId, user);
  }

  @Post(':attemptId/submit')
  @Roles('student', 'teacher', 'tutor')
  @ApiOperation({ summary: 'Submit attempt' })
  @ApiResponse({ status: 200, description: 'Attempt submitted with result' })
  submit(
    @CurrentUser() user: JwtPayload,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body() dto: SubmitAttemptDto,
  ) {
    return this.attempts.submit({
      attemptId,
      submitReason: SubmitReason.Manual,
      actor: user,
      answers: dto.answers?.map((answer) => ({
        questionSnapshotId: answer.question_snapshot_id,
        textAnswer: answer.text ?? null,
        selectedAnswerSnapshotIds: answer.selected_answer_snapshot_ids,
        textProvided: answer.text !== undefined,
        selectionsProvided: answer.selected_answer_snapshot_ids !== undefined,
      })),
    });
  }
}
