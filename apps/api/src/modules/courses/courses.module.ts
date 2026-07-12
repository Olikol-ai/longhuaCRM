import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CertificatesModule } from '../certificates/certificates.module';
import { CourseTemplateEntity } from './entities/course-template.entity';
import { EnrollmentEntity } from './entities/enrollment.entity';
import { CoursesController } from './courses.controller';
import { CoursesRepository } from './courses.repository';
import { CoursesService } from './courses.service';
import { EnrollmentProgressService } from './enrollment-progress.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CourseTemplateEntity, EnrollmentEntity]),
    forwardRef(() => CertificatesModule),
  ],
  controllers: [CoursesController],
  providers: [CoursesRepository, CoursesService, EnrollmentProgressService],
  exports: [CoursesRepository, CoursesService, EnrollmentProgressService, TypeOrmModule],
})
export class CoursesModule {}
