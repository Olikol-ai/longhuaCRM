import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/auth.service';
import { CreateTutorInviteDto } from './dto/create-tutor-invite.dto';
import { TutorInvitesService } from './tutor-invites.service';

@Controller('tutor-invite-links')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'tutor')
export class TutorInvitesController {
  constructor(private readonly tutorInvites: TutorInvitesService) {}

  /**
   * Idempotent: returns the tutor's single active public link,
   * creating it only when none exists. Never duplicates.
   */
  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTutorInviteDto) {
    const ensured = await this.tutorInvites.ensureMine(user, dto.label);
    return {
      id: ensured.id,
      token: ensured.token,
      expires_at: ensured.expiresAt.toISOString(),
      label: ensured.label,
      created: ensured.created,
      path: `/register?ref=${encodeURIComponent(ensured.token)}`,
    };
  }

  @Get()
  listMine(@CurrentUser() user: JwtPayload) {
    return this.tutorInvites.listMine(user);
  }

  @Post(':id/revoke')
  revoke(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.tutorInvites.revoke(user, id);
  }
}
