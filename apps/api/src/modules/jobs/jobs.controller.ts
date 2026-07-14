import { Controller, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JobsService } from './jobs.service';

@Controller('jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post('export-backup')
  exportBackup() {
    return this.jobsService.exportBackup();
  }

  @Post('auto-complete-lessons')
  autoCompleteExpiredLessons() {
    return this.jobsService.autoCompleteExpiredLessons();
  }

  @Post('revoke-all-access')
  revokeAllAccess() {
    return this.jobsService.revokeAllAccess();
  }
}
