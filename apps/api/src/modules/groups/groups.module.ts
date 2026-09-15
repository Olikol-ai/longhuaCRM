import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { B2bSalesModule } from '../b2b-sales/b2b-sales.module';
import { LessonSeriesModule } from '../lesson-series/lesson-series.module';
import { LessonsModule } from '../lessons/lessons.module';
import { GroupEntity } from './entities/group.entity';
import { GroupMemberEntity } from './entities/group-member.entity';
import { GroupsController } from './groups.controller';
import { GroupsRepository } from './groups.repository';
import { GroupsService } from './groups.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([GroupEntity, GroupMemberEntity]),
    LessonSeriesModule,
    LessonsModule,
    forwardRef(() => B2bSalesModule),
  ],
  controllers: [GroupsController],
  providers: [GroupsRepository, GroupsService],
  exports: [GroupsRepository, GroupsService, TypeOrmModule],
})
export class GroupsModule {}
