import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/auth.service';
import { AdjustStudentLessonBalanceDto } from './dto/adjust-student-lesson-balance.dto';
import {
  AdminBalancesQueryDto,
  normalizeAdminBalancesQuery,
} from './dto/admin-balances-query.dto';
import { StudentBalancesService } from './student-balances.service';

@Controller('admin/balances')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class StudentBalancesController {
  constructor(private readonly balancesService: StudentBalancesService) {}

  @Get()
  list(
    @CurrentUser() _user: JwtPayload,
    @Query() query: Record<string, unknown>,
  ) {
    const normalized: AdminBalancesQueryDto = normalizeAdminBalancesQuery(query);
    return this.balancesService.list(normalized);
  }

  @Get(':studentId')
  detail(
    @CurrentUser() _user: JwtPayload,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.balancesService.detail(studentId);
  }

  /**
   * Absolute lesson-balance correction with audit (no fake payment/lesson).
   */
  @Post(':studentId/adjust-lessons')
  adjustLessons(
    @CurrentUser() user: JwtPayload,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: AdjustStudentLessonBalanceDto,
  ) {
    return this.balancesService.adjustLessonBalance(user, studentId, dto);
  }
}
