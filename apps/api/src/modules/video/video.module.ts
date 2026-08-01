import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainAccessModule } from '../../common/access/domain-access.module';
import { ChatEntity } from '../chats/entities/chat.entity';
import { ChatMemberEntity } from '../chats/entities/chat-member.entity';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { AttendanceEntity } from '../lessons/entities/attendance.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { TutorEntity } from '../tutors/entities/tutor.entity';
import { UserEntity } from '../users/entities/user.entity';
import { JitsiJwtService } from './providers/jitsi-jwt.service';
import { JitsiVideoProvider } from './providers/jitsi-video.provider';
import { VIDEO_PROVIDER } from './providers/video-provider.interface';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';

@Module({
  imports: [
    ConfigModule,
    DomainAccessModule,
    TypeOrmModule.forFeature([
      LessonEntity,
      TeacherEntity,
      TutorEntity,
      StudentEntity,
      UserEntity,
      AttendanceEntity,
      ChatEntity,
      ChatMemberEntity,
    ]),
  ],
  controllers: [VideoController],
  providers: [
    JitsiJwtService,
    JitsiVideoProvider,
    {
      provide: VIDEO_PROVIDER,
      useExisting: JitsiVideoProvider,
    },
    VideoService,
  ],
  exports: [VideoService, VIDEO_PROVIDER, JitsiJwtService],
})
export class VideoModule {}
