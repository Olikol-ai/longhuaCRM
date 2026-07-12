import { Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { CourseAccessService } from '../../common/access/course-access.service';
import { JwtPayload } from '../auth/auth.service';
import { CourseTemplateEntity } from './entities/course-template.entity';
import { EnrollmentEntity } from './entities/enrollment.entity';
import { CreateCourseTemplateDto } from './dto/create-course-template.dto';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateCourseTemplateDto } from './dto/update-course-template.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { EnrollmentProgressService } from './enrollment-progress.service';
import { CoursesRepository } from './courses.repository';

@Injectable()
export class CoursesService {
  constructor(
    private readonly repository: CoursesRepository,
    private readonly courseAccess: CourseAccessService,
    private readonly enrollmentProgress: EnrollmentProgressService,
  ) {}

  async findAllTemplates(actor: JwtPayload): Promise<CourseTemplateEntity[]> {
    const where = this.courseAccess.scopeTemplateFilter(actor, {});
    return this.repository.filterTemplates(where as FindOptionsWhere<CourseTemplateEntity>);
  }

  async findTemplateById(actor: JwtPayload, id: string): Promise<CourseTemplateEntity> {
    await this.courseAccess.assertCanReadTemplate(actor, id);
    const row = await this.repository.findTemplateById(id);
    if (!row) {
      throw new NotFoundException('Course template not found');
    }
    return row;
  }

  createTemplate(dto: CreateCourseTemplateDto): Promise<CourseTemplateEntity> {
    return this.repository.saveTemplate(dto);
  }

  async updateTemplate(id: string, dto: UpdateCourseTemplateDto): Promise<CourseTemplateEntity> {
    const row = await this.repository.updateTemplate(id, dto);
    if (!row) {
      throw new NotFoundException('Course template not found');
    }
    return row;
  }

  async deleteTemplate(id: string): Promise<void> {
    const row = await this.repository.findTemplateById(id);
    if (!row) {
      throw new NotFoundException('Course template not found');
    }
    await this.repository.deleteTemplate(id);
  }

  async filterTemplates(
    actor: JwtPayload,
    where: Record<string, unknown>,
  ): Promise<CourseTemplateEntity[]> {
    const scoped = this.courseAccess.scopeTemplateFilter(actor, where);
    return this.repository.filterTemplates(scoped as FindOptionsWhere<CourseTemplateEntity>);
  }

  async findAllEnrollments(actor: JwtPayload): Promise<EnrollmentEntity[]> {
    const where = await this.courseAccess.scopeEnrollmentFilter(actor, {});
    return this.repository.filterEnrollments(where as FindOptionsWhere<EnrollmentEntity>);
  }

  async findEnrollmentById(actor: JwtPayload, id: string): Promise<EnrollmentEntity & { remainingLessons: number }> {
    await this.courseAccess.assertCanReadEnrollment(actor, id);
    const row = await this.repository.findEnrollmentById(id);
    if (!row) {
      throw new NotFoundException('Enrollment not found');
    }
    return {
      ...row,
      remainingLessons: this.enrollmentProgress.computeRemaining(row),
    };
  }

  async getEnrollmentProgress(actor: JwtPayload, id: string) {
    const enrollment = await this.findEnrollmentById(actor, id);
    return this.enrollmentProgress.toProgress(enrollment);
  }

  createEnrollment(dto: CreateEnrollmentDto): Promise<EnrollmentEntity> {
    return this.repository.saveEnrollment(dto);
  }

  async updateEnrollment(id: string, dto: UpdateEnrollmentDto): Promise<EnrollmentEntity> {
    const row = await this.repository.updateEnrollment(id, dto);
    if (!row) {
      throw new NotFoundException('Enrollment not found');
    }
    return row;
  }

  async deleteEnrollment(id: string): Promise<void> {
    const row = await this.repository.findEnrollmentById(id);
    if (!row) {
      throw new NotFoundException('Enrollment not found');
    }
    await this.repository.deleteEnrollment(id);
  }

  async filterEnrollments(
    actor: JwtPayload,
    where: Record<string, unknown>,
  ): Promise<EnrollmentEntity[]> {
    const scoped = await this.courseAccess.scopeEnrollmentFilter(actor, where);
    return this.repository.filterEnrollments(scoped as FindOptionsWhere<EnrollmentEntity>);
  }
}
