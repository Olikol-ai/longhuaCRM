import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainAccessModule } from '../../common/access/domain-access.module';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { UserEntity } from '../users/entities/user.entity';
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
      StudentEntity,
      UserEntity,
    ]),
  ],
  controllers: [VideoController],
  providers: [
    JitsiVideoProvider,
    {
      provide: VIDEO_PROVIDER,
      useExisting: JitsiVideoProvider,
    },
    VideoService,
  ],
  exports: [VideoService, VIDEO_PROVIDER],
})
export class VideoModule {}
