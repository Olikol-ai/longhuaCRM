import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/auth.service';
import { AdminDashboardService } from './admin-dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly adminDashboard: AdminDashboardService) {}

  /**
   * Canonical Admin Dashboard SSOT.
   * No client-side caching — always live DB counts / day queries.
   */
  @Get('admin')
  @Roles('admin')
  @Header('Cache-Control', 'no-store')
  getAdminSummary(@CurrentUser() user: JwtPayload) {
    return this.adminDashboard.getSummary(user);
  }
}
