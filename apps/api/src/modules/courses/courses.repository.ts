import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { CourseTemplateEntity } from './entities/course-template.entity';
import { EnrollmentEntity } from './entities/enrollment.entity';

@Injectable()
export class CoursesRepository {
  constructor(
    @InjectRepository(CourseTemplateEntity)
    private readonly templateRepo: Repository<CourseTemplateEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepo: Repository<EnrollmentEntity>,
  ) {}

  findAllTemplates(): Promise<CourseTemplateEntity[]> {
    return this.templateRepo.find();
  }

  findTemplateById(id: string): Promise<CourseTemplateEntity | null> {
    return this.templateRepo.findOne({ where: { id } });
  }

  saveTemplate(entity: Partial<CourseTemplateEntity>): Promise<CourseTemplateEntity> {
    return this.templateRepo.save(this.templateRepo.create(entity));
  }

  async updateTemplate(
    id: string,
    data: Partial<CourseTemplateEntity>,
  ): Promise<CourseTemplateEntity | null> {
    await this.templateRepo.update({ id }, data);
    return this.findTemplateById(id);
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.templateRepo.delete({ id });
  }

  filterTemplates(
    where: FindOptionsWhere<CourseTemplateEntity>,
  ): Promise<CourseTemplateEntity[]> {
    return this.templateRepo.find({ where });
  }

  findAllEnrollments(): Promise<EnrollmentEntity[]> {
    return this.enrollmentRepo.find();
  }

  findEnrollmentById(id: string): Promise<EnrollmentEntity | null> {
    return this.enrollmentRepo.findOne({ where: { id } });
  }

  saveEnrollment(entity: Partial<EnrollmentEntity>): Promise<EnrollmentEntity> {
    return this.enrollmentRepo.save(this.enrollmentRepo.create(entity));
  }

  async updateEnrollment(
    id: string,
    data: Partial<EnrollmentEntity>,
  ): Promise<EnrollmentEntity | null> {
    await this.enrollmentRepo.update({ id }, data);
    return this.findEnrollmentById(id);
  }

  async deleteEnrollment(id: string): Promise<void> {
    await this.enrollmentRepo.delete({ id });
  }

  filterEnrollments(where: FindOptionsWhere<EnrollmentEntity>): Promise<EnrollmentEntity[]> {
    return this.enrollmentRepo.find({ where });
  }
}
