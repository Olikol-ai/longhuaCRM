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
import { StudentBalanceLegacyMigrationService } from './student-balance-legacy-migration.service';

@Controller('admin/balances')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class StudentBalancesController {
  constructor(
    private readonly balancesService: StudentBalancesService,
    private readonly legacyMigration: StudentBalanceLegacyMigrationService,
  ) {}

  @Get()
  list(
    @CurrentUser() _user: JwtPayload,
    @Query() query: Record<string, unknown>,
  ) {
    const normalized: AdminBalancesQueryDto = normalizeAdminBalancesQuery(query);
    return this.balancesService.list(normalized);
  }

  /**
   * Reconciliation summary across students (diagnostic only).
   * Must be registered before :studentId routes.
   */
  @Get('reconciliation/summary')
  reconciliationSummary(@Query('limit') limit?: string) {
    const n = limit ? Number(limit) : 500;
    return this.balancesService.balanceReconciliationSummary(
      Number.isFinite(n) ? n : 500,
    );
  }

  /**
   * Idempotent legacy → ledger import (admin). Prefer CLI for one-shot prod runs.
   * Query dryRun=1 to preview without writes.
   */
  @Post('legacy-import')
  legacyImport(@Query('dryRun') dryRun?: string) {
    return this.legacyMigration.importAll({
      dryRun: dryRun === '1' || dryRun === 'true',
    });
  }

  @Get(':studentId')
  detail(
    @CurrentUser() _user: JwtPayload,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.balancesService.detail(studentId);
  }

  /**
   * Per-student ledger audit (current vs ledger-derived). Never mutates.
   */
  @Get(':studentId/balance-audit')
  balanceAudit(
    @CurrentUser() _user: JwtPayload,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.balancesService.balanceAudit(studentId);
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
