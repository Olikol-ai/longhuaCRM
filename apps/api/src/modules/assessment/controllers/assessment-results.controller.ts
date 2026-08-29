import {
  Body,
  Controller,
  Get,
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
import { ListResultsQueryDto, SaveReviewDto, paginateArray } from '../dto';
import { ResultService } from '../services/result.service';

@ApiTags('Assessment Results')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assessment/results')
export class AssessmentResultsController {
  constructor(private readonly results: ResultService) {}

  @Get()
  @Roles('admin', 'teacher', 'tutor', 'student')
  @ApiOperation({ summary: 'List results' })
  @ApiResponse({ status: 200, description: 'Paginated result list' })
  async list(@CurrentUser() user: JwtPayload, @Query() query: ListResultsQueryDto) {
    const items = await this.results.listFiltered(
      {
        examId: query.exam_id,
        studentId: query.student_id,
        teacherId: query.teacher_id,
        passed: query.passed,
        from: query.from,
        to: query.to,
      },
      user,
    );
    return paginateArray(items, query.limit, query.offset);
  }

  @Get(':resultId/review')
  @Roles('admin', 'teacher', 'tutor')
  @ApiOperation({ summary: 'Get teacher review workspace for a result' })
  @ApiResponse({ status: 200, description: 'Review bundle' })
  getReview(
    @CurrentUser() user: JwtPayload,
    @Param('resultId', ParseUUIDPipe) resultId: string,
  ) {
    return this.results.getReviewBundle(resultId, user);
  }

  @Patch(':resultId/review')
  @Roles('admin', 'teacher', 'tutor')
  @ApiOperation({ summary: 'Save manual scores and comments' })
  @ApiResponse({ status: 200, description: 'Review scores saved' })
  saveReview(
    @CurrentUser() user: JwtPayload,
    @Param('resultId', ParseUUIDPipe) resultId: string,
    @Body() dto: SaveReviewDto,
  ) {
    return this.results.saveReview(
      resultId,
      user,
      dto.answers.map((a) => ({
        questionSnapshotId: a.question_snapshot_id,
        score: a.score,
        comment: a.comment,
      })),
    );
  }

  @Post(':resultId/review/finalize')
  @Roles('admin', 'teacher', 'tutor')
  @ApiOperation({ summary: 'Finalize manual review → passed/failed' })
  @ApiResponse({ status: 200, description: 'Result finalized' })
  finalizeReview(
    @CurrentUser() user: JwtPayload,
    @Param('resultId', ParseUUIDPipe) resultId: string,
  ) {
    return this.results.finalizeReview(resultId, user);
  }

  @Get(':resultId/feedback')
  @Roles('admin', 'teacher', 'tutor', 'student')
  @ApiOperation({
    summary:
      'Student-visible per-question feedback (own result only; read-only)',
  })
  @ApiResponse({ status: 200, description: 'Student feedback bundle' })
  getStudentFeedback(
    @CurrentUser() user: JwtPayload,
    @Param('resultId', ParseUUIDPipe) resultId: string,
  ) {
    return this.results.getStudentFeedback(resultId, user);
  }

  @Get(':resultId')
  @Roles('admin', 'teacher', 'tutor', 'student')
  @ApiOperation({ summary: 'Get result by id' })
  @ApiResponse({ status: 200, description: 'Result detail' })
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('resultId', ParseUUIDPipe) resultId: string,
  ) {
    return this.results.getForActor(resultId, user);
  }
}
