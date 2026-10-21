import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
  AdminAttemptRegistryQueryDto,
  AdminExamRegistryQueryDto,
} from '../dto/admin/admin-assessment-query.dto';
import { AdminAssessmentService } from '../services/admin-assessment.service';

@ApiTags('Assessment Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('assessment/admin')
export class AssessmentAdminController {
  constructor(private readonly admin: AdminAssessmentService) {}

  @Get('exams')
  @ApiOperation({
    summary: 'Admin registry of all exams with attempt/result aggregates',
  })
  @ApiResponse({ status: 200, description: 'Paginated exam registry' })
  listExams(
    @CurrentUser() user: JwtPayload,
    @Query() query: AdminExamRegistryQueryDto,
  ) {
    return this.admin.listExams(user, {
      limit: query.limit,
      offset: query.offset,
      search: query.search,
      createdByUserId: query.created_by_user_id,
      assignedByUserId: query.assigned_by_user_id,
    });
  }

  @Get('attempts')
  @ApiOperation({
    summary: 'Admin registry of all attempts across teachers/students',
  })
  @ApiResponse({ status: 200, description: 'Paginated attempt registry' })
  listAttempts(
    @CurrentUser() user: JwtPayload,
    @Query() query: AdminAttemptRegistryQueryDto,
  ) {
    return this.admin.listAttempts(user, {
      limit: query.limit,
      offset: query.offset,
      examSearch: query.exam_search,
      examId: query.exam_id,
      studentId: query.student_id,
      studentSearch: query.student_search,
      assignedByUserId: query.assigned_by_user_id,
      attemptStatus: query.attempt_status,
      resultStatus: query.result_status,
      from: query.from,
      to: query.to,
      manualOnly: query.manual_only,
    });
  }

  @Get('attempts/:attemptId')
  @ApiOperation({
    summary: 'Admin attempt detail: answers, scores, score history',
  })
  @ApiResponse({ status: 200, description: 'Attempt detail bundle' })
  getAttemptDetail(
    @CurrentUser() user: JwtPayload,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
  ) {
    return this.admin.getAttemptDetail(user, attemptId);
  }

  @Get('results/:resultId/score-history')
  @ApiOperation({ summary: 'Final-score adjustment history for a result' })
  @ApiResponse({ status: 200, description: 'Score history entries' })
  getScoreHistory(
    @CurrentUser() user: JwtPayload,
    @Param('resultId', ParseUUIDPipe) resultId: string,
  ) {
    return this.admin.getScoreHistoryForResult(user, resultId);
  }
}
