import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { AssessmentService } from '../services/assessment.service';

/**
 * Assessment module connectivity probe.
 * No domain logic — confirms the bounded context is registered.
 */
@ApiTags('Assessment')
@ApiBearerAuth()
@SkipThrottle()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assessment')
export class AssessmentController {
  constructor(private readonly assessmentService: AssessmentService) {}

  @Get('health')
  @Roles('admin', 'teacher', 'tutor', 'student')
  @ApiOperation({ summary: 'Assessment module health check' })
  @ApiResponse({ status: 200, description: 'Module is registered' })
  health() {
    return this.assessmentService.getModuleStatus();
  }
}
