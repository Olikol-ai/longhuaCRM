import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
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

  /** Refresh short-lived Jitsi JWT (same ACL as getLessonVideo). */
  @Post('lessons/:id/token')
  @Roles('admin', 'teacher', 'student', 'tutor', 'tutor_student')
  refreshToken(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.video.getLessonVideoAccess(user, id);
  }

  @Get('lessons/:id/participants')
  @Roles('admin', 'teacher', 'student', 'tutor', 'tutor_student')
  participants(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.video.getLessonParticipants(user, id);
  }

  @Post('lessons/:id/chat')
  @Roles('admin', 'teacher', 'student', 'tutor', 'tutor_student')
  lessonChat(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.video.ensureLessonChat(user, id);
  }
}
