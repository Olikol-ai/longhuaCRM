import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/auth.service';
import { VideoService } from './video.service';

@Controller('video')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VideoController {
  constructor(private readonly video: VideoService) {}

  @Get('lessons/:id')
  @Roles('admin', 'teacher', 'student', 'tutor', 'tutor_student')
  getLessonVideo(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.video.getLessonVideoAccess(user, id);
  }
}
