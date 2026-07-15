import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { MaterialAccessEntity } from '../materials/entities/material-access.entity';
import { MaterialCourseGrantEntity } from '../materials/entities/material-course-grant.entity';
import { MaterialFolderEntity } from '../materials/entities/material-folder.entity';
import { MaterialGroupGrantEntity } from '../materials/entities/material-group-grant.entity';
import { MaterialEntity } from '../materials/entities/material.entity';
import { CourseTemplateEntity } from './entities/course-template.entity';
import { EnrollmentEntity } from './entities/enrollment.entity';

@Injectable()
export class CoursesRepository {
  constructor(
    @InjectRepository(CourseTemplateEntity)
    private readonly templateRepo: Repository<CourseTemplateEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepo: Repository<EnrollmentEntity>,
    @InjectRepository(MaterialFolderEntity)
    private readonly folderRepo: Repository<MaterialFolderEntity>,
    @InjectRepository(MaterialEntity)
    private readonly materialRepo: Repository<MaterialEntity>,
    @InjectRepository(MaterialAccessEntity)
    private readonly accessRepo: Repository<MaterialAccessEntity>,
    @InjectRepository(MaterialCourseGrantEntity)
    private readonly courseGrantRepo: Repository<MaterialCourseGrantEntity>,
    @InjectRepository(MaterialGroupGrantEntity)
    private readonly groupGrantRepo: Repository<MaterialGroupGrantEntity>,
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

  /**
   * Soft-delete course from active catalog.
   * Keeps the course row (enrollments, certificates, lesson history stay intact).
   * Soft-deletes course materials, revokes personal access, and clears course/group grants.
   * Folders remain linked to the archived course (hidden once course leaves the catalog).
   */
  async archiveTemplate(id: string): Promise<CourseTemplateEntity> {
    await this.templateRepo.update({ id }, { isActive: false });

    const folders = await this.folderRepo.find({
      where: { courseTemplateId: id },
      select: ['id'],
    });
    const folderIds = folders.map((folder) => folder.id);

    let materialIds: string[] = [];
    if (folderIds.length > 0) {
      const materials = await this.materialRepo.find({
        where: { folderId: In(folderIds) },
        select: ['id'],
      });
      materialIds = materials.map((m) => m.id);

      await this.materialRepo.update(
        { folderId: In(folderIds), status: 'active' },
        { status: 'deleted' },
      );
    }

    if (materialIds.length > 0) {
      await this.accessRepo.update(
        { materialId: In(materialIds), access: true },
        { access: false },
      );
      await this.groupGrantRepo.delete({ materialId: In(materialIds) });
    }

    // Explicit course grants for this template
    await this.courseGrantRepo.delete({ courseTemplateId: id });

    const row = await this.findTemplateById(id);
    if (!row) {
      throw new Error('Course template not found after archive');
    }
    return row;
  }

  filterTemplates(
    where: FindOptionsWhere<CourseTemplateEntity>,
  ): Promise<CourseTemplateEntity[]> {
    return this.templateRepo.find({
      where,
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
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
