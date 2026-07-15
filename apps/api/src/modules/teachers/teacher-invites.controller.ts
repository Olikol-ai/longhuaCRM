import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/auth.service';
import { CreateTeacherInviteDto } from './dto/create-teacher-invite.dto';
import { TeacherInvitesService } from './teacher-invites.service';

@Controller('teacher-invites')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'teacher')
export class TeacherInvitesController {
  constructor(private readonly teacherInvites: TeacherInvitesService) {}

  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTeacherInviteDto) {
    const created = await this.teacherInvites.create(user, dto.label);
    return {
      id: created.id,
      token: created.token,
      expires_at: created.expiresAt.toISOString(),
      label: created.label,
      path: `/register?ref=${encodeURIComponent(created.token)}`,
    };
  }

  @Get()
  listMine(@CurrentUser() user: JwtPayload) {
    return this.teacherInvites.listMine(user);
  }

  @Post(':id/revoke')
  revoke(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.teacherInvites.revoke(user, id);
  }
}
