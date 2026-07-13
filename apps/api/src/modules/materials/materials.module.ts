import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseTemplateEntity } from '../courses/entities/course-template.entity';
import { EnrollmentEntity } from '../courses/entities/enrollment.entity';
import { GroupEntity } from '../groups/entities/group.entity';
import { GroupMemberEntity } from '../groups/entities/group-member.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { MaterialAccessEntity } from './entities/material-access.entity';
import { MaterialCourseGrantEntity } from './entities/material-course-grant.entity';
import { MaterialFolderEntity } from './entities/material-folder.entity';
import { MaterialGroupGrantEntity } from './entities/material-group-grant.entity';
import { MaterialLinkEntity } from './entities/material-link.entity';
import { MaterialEntity } from './entities/material.entity';
import { MaterialsController, MaterialAccessController } from './materials.controller';
import { MaterialsRepository } from './materials.repository';
import { MaterialsService } from './materials.service';
import { MaterialAccessCheckService } from './material-access-check.service';
import { MaterialAccessService } from './material-access.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MaterialEntity,
      MaterialFolderEntity,
      MaterialAccessEntity,
      MaterialCourseGrantEntity,
      MaterialGroupGrantEntity,
      MaterialLinkEntity,
      StudentEntity,
      TeacherEntity,
      GroupEntity,
      GroupMemberEntity,
      EnrollmentEntity,
      CourseTemplateEntity,
    ]),
  ],
  controllers: [MaterialsController, MaterialAccessController],
  providers: [
    MaterialsRepository,
    MaterialsService,
    MaterialAccessService,
    MaterialAccessCheckService,
  ],
  exports: [
    MaterialsRepository,
    MaterialsService,
    MaterialAccessService,
    MaterialAccessCheckService,
    TypeOrmModule,
  ],
})
export class MaterialsModule {}
