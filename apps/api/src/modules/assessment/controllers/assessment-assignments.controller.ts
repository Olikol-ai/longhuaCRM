import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
  CreateAssignmentDto,
  ListAssignmentsQueryDto,
  paginateArray,
} from '../dto';
import { AssignmentService } from '../services/assignment.service';
import { AssessmentAssignmentNotifier } from '../services/assessment-assignment-notifier.service';

@ApiTags('Assessment Assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assessment/assignments')
export class AssessmentAssignmentsController {
  constructor(
    private readonly assignments: AssignmentService,
    private readonly assignmentNotifier: AssessmentAssignmentNotifier,
  ) {}

  @Post()
  @Roles('admin', 'teacher', 'tutor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign exam to audience' })
  @ApiResponse({ status: 201, description: 'Assignment created' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateAssignmentDto) {
    const created = await this.assignments.create(
      {
        examId: dto.exam_id,
        targetType: dto.target_type,
        targetId: dto.target_id,
        validFrom: dto.valid_from ? new Date(dto.valid_from) : null,
        validTo: dto.valid_to ? new Date(dto.valid_to) : null,
        assessmentRuleOverrideId: dto.assessment_rule_override_id ?? null,
        assignedByUserId: user.sub,
      },
      user,
    );
    this.assignmentNotifier.notifyAssignmentCreated(created);
    return created;
  }

  @Get()
  @Roles('admin', 'teacher', 'tutor', 'student')
  @ApiOperation({ summary: 'List assignments' })
  @ApiResponse({ status: 200, description: 'Paginated assignment list' })
  async list(@CurrentUser() user: JwtPayload, @Query() query: ListAssignmentsQueryDto) {
    const items = await this.assignments.listFiltered(
      {
        examId: query.exam_id,
        targetType: query.target_type,
        targetId: query.target_id,
        active: query.active,
      },
      user,
    );
    return paginateArray(items, query.limit, query.offset);
  }

  @Get(':assignmentId')
  @Roles('admin', 'teacher', 'tutor', 'student')
  @ApiOperation({ summary: 'Get assignment detail' })
  @ApiResponse({ status: 200, description: 'Assignment detail' })
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ) {
    return this.assignments.getForActor(assignmentId, user);
  }

  @Post(':assignmentId/cancel')
  @Roles('admin', 'teacher', 'tutor')
  @ApiOperation({ summary: 'Cancel assignment' })
  @ApiResponse({ status: 200, description: 'Assignment cancelled' })
  cancel(
    @CurrentUser() user: JwtPayload,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ) {
    return this.assignments.cancel(assignmentId, user);
  }
}
