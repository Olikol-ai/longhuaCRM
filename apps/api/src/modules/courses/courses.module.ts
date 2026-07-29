import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CertificatesModule } from '../certificates/certificates.module';
import { MaterialAccessEntity } from '../materials/entities/material-access.entity';
import { MaterialCourseGrantEntity } from '../materials/entities/material-course-grant.entity';
import { MaterialFolderEntity } from '../materials/entities/material-folder.entity';
import { MaterialGroupGrantEntity } from '../materials/entities/material-group-grant.entity';
import { MaterialEntity } from '../materials/entities/material.entity';
import { CourseTemplateEntity } from './entities/course-template.entity';
import { EnrollmentEntity } from './entities/enrollment.entity';
import { CoursesController } from './courses.controller';
import { CoursesRepository } from './courses.repository';
import { CoursesService } from './courses.service';
import { EnrollmentProgressService } from './enrollment-progress.service';
import { ChatsModule } from '../chats/chats.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CourseTemplateEntity,
      EnrollmentEntity,
      MaterialFolderEntity,
      MaterialEntity,
      MaterialAccessEntity,
      MaterialCourseGrantEntity,
      MaterialGroupGrantEntity,
    ]),
    forwardRef(() => CertificatesModule),
    forwardRef(() => ChatsModule),
  ],
  controllers: [CoursesController],
  providers: [CoursesRepository, CoursesService, EnrollmentProgressService],
  exports: [CoursesRepository, CoursesService, EnrollmentProgressService, TypeOrmModule],
})
export class CoursesModule {}
