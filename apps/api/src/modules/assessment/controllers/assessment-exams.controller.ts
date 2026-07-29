import {
  Body,
  Controller,
  Delete,
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
  CreateExamDto,
  ExamRuleDto,
  ListExamsQueryDto,
  UpdateExamDto,
  paginateArray,
} from '../dto';
import { ExamRuleInput, ExamService } from '../services/exam.service';

function mapExamRuleDto(rule: ExamRuleDto): ExamRuleInput {
  return {
    durationMinutes: rule.duration_minutes,
    maxAttempts: rule.max_attempts,
    allowRetake: rule.allow_retake,
    retakePolicy: rule.retake_policy,
    allowReview: rule.allow_review,
    showResultAfterSubmit: rule.show_result_after_submit,
    showCorrectAnswers: rule.show_correct_answers,
    autoSubmitOnTimeout: rule.auto_submit_on_timeout,
    allowPause: rule.allow_pause,
    randomizeQuestions: rule.randomize_questions,
    randomizeAnswers: rule.randomize_answers,
    passingMode: rule.passing_mode,
    passScorePercent: rule.pass_score_percent,
    allowNavigation: rule.allow_navigation,
  };
}

@ApiTags('Assessment Exams')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assessment/exams')
export class AssessmentExamsController {
  constructor(private readonly exams: ExamService) {}

  @Post()
  @Roles('admin', 'teacher', 'tutor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create exam from ExamBlocks' })
  @ApiResponse({ status: 201, description: 'Exam created' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateExamDto) {
    return this.exams.create(
      {
        blockIds: dto.block_ids,
        name: dto.name,
        availableFrom: dto.available_from ? new Date(dto.available_from) : null,
        availableTo: dto.available_to ? new Date(dto.available_to) : null,
        rule: mapExamRuleDto(dto.rule),
        createdByUserId: user.sub,
      },
      user,
    );
  }

  @Get()
  @Roles('admin', 'teacher', 'tutor', 'student')
  @ApiOperation({ summary: 'List exams' })
  @ApiResponse({ status: 200, description: 'Paginated exam list' })
  async list(@CurrentUser() user: JwtPayload, @Query() query: ListExamsQueryDto) {
    let items = await this.exams.listForActor(user, query.status);
    if (query.search) {
      const needle = query.search.toLowerCase();
      items = items.filter((row) => row.name.toLowerCase().includes(needle));
    }
    return paginateArray(items, query.limit, query.offset);
  }

  @Get(':examId')
  @Roles('admin', 'teacher', 'tutor', 'student')
  @ApiOperation({ summary: 'Get exam detail' })
  @ApiResponse({ status: 200, description: 'Exam detail' })
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('examId', ParseUUIDPipe) examId: string,
  ) {
    return this.exams.getForActor(examId, user);
  }

  @Patch(':examId')
  @Roles('admin', 'teacher', 'tutor')
  @ApiOperation({ summary: 'Update draft exam' })
  @ApiResponse({ status: 200, description: 'Exam updated' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('examId', ParseUUIDPipe) examId: string,
    @Body() dto: UpdateExamDto,
  ) {
    return this.exams.update(
      examId,
      {
        name: dto.name,
        availableFrom:
          dto.available_from === undefined
            ? undefined
            : dto.available_from
              ? new Date(dto.available_from)
              : null,
        availableTo:
          dto.available_to === undefined
            ? undefined
            : dto.available_to
              ? new Date(dto.available_to)
              : null,
        rule: dto.rule ? mapExamRuleDto(dto.rule) : undefined,
      },
      user,
    );
  }

  @Post(':examId/publish')
  @Roles('admin', 'teacher', 'tutor')
  @ApiOperation({ summary: 'Publish exam (ACTIVE)' })
  @ApiResponse({ status: 200, description: 'Exam published' })
  publish(
    @CurrentUser() user: JwtPayload,
    @Param('examId', ParseUUIDPipe) examId: string,
  ) {
    return this.exams.publish(examId, user);
  }

  @Post(':examId/archive')
  @Roles('admin', 'teacher', 'tutor')
  @ApiOperation({ summary: 'Archive exam' })
  @ApiResponse({ status: 200, description: 'Exam archived' })
  archive(
    @CurrentUser() user: JwtPayload,
    @Param('examId', ParseUUIDPipe) examId: string,
  ) {
    return this.exams.archive(examId, user);
  }

  @Delete(':examId')
  @Roles('admin', 'teacher', 'tutor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete unused exam or archive if used' })
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('examId', ParseUUIDPipe) examId: string,
  ) {
    return this.exams.deleteOrArchive(examId, user);
  }

  @Get(':examId/preview')
  @Roles('admin', 'teacher', 'tutor')
  @ApiOperation({ summary: 'Preview materialized exam' })
  @ApiResponse({ status: 200, description: 'Exam preview' })
  preview(
    @CurrentUser() user: JwtPayload,
    @Param('examId', ParseUUIDPipe) examId: string,
  ) {
    return this.exams.preview(examId, user);
  }
}
