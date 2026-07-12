import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { normalizeRole } from '../constants/roles';
import { filterToEntityWhere } from '../utils/api-record.util';
import { EnrollmentEntity } from '../../modules/courses/entities/enrollment.entity';
import { MaterialAccessEntity } from '../../modules/materials/entities/material-access.entity';
import { MaterialFolderEntity } from '../../modules/materials/entities/material-folder.entity';
import { MaterialEntity } from '../../modules/materials/entities/material.entity';
import { StudentEntity } from '../../modules/students/entities/student.entity';
import { TeacherEntity } from '../../modules/teachers/entities/teacher.entity';
import { NO_ACCESS_UUID } from './access.constants';
import { DomainAccessActor } from './domain-access.types';

@Injectable()
export class MaterialsDomainAccessService {
  constructor(
    @InjectRepository(MaterialEntity)
    private readonly materialRepo: Repository<MaterialEntity>,
    @InjectRepository(MaterialFolderEntity)
    private readonly folderRepo: Repository<MaterialFolderEntity>,
    @InjectRepository(MaterialAccessEntity)
    private readonly accessRepo: Repository<MaterialAccessEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepo: Repository<EnrollmentEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
  ) {}

  isAdmin(actor: DomainAccessActor): boolean {
    return normalizeRole(actor.role) === 'admin';
  }

  async scopeMaterialFilter(
    actor: DomainAccessActor,
    where: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (this.isAdmin(actor)) {
      return filterToEntityWhere(where);
    }

    const role = normalizeRole(actor.role);
    if (role === 'student') {
      const rows = await this.accessRepo.find({
        where: { userId: actor.sub, access: true },
      });
      const ids = rows.map((row) => row.materialId);
      if (ids.length === 0) {
        return { id: NO_ACCESS_UUID };
      }
      const scoped = filterToEntityWhere(where);
      if (scoped.id) {
        return scoped;
      }
      return { ...scoped, id: In(ids) };
    }

    if (role === 'teacher') {
      const materialIds = await this.resolveTeacherMaterialIds(actor);
      if (materialIds.length === 0) {
        return { id: NO_ACCESS_UUID };
      }
      const scoped = filterToEntityWhere(where);
      if (scoped.id) {
        return scoped;
      }
      return { ...scoped, id: In(materialIds) };
    }

    throw new ForbiddenException('Forbidden');
  }

  async scopeFolderFilter(
    actor: DomainAccessActor,
    where: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (this.isAdmin(actor)) {
      return filterToEntityWhere(where);
    }

    const role = normalizeRole(actor.role);
    if (role === 'student' || role === 'teacher') {
      const courseTemplateIds = await this.resolveAccessibleCourseTemplateIds(actor);
      if (courseTemplateIds.length === 0) {
        return { courseTemplateId: NO_ACCESS_UUID };
      }
      const scoped = filterToEntityWhere(where);
      if (scoped.courseTemplateId) {
        return scoped;
      }
      return { ...scoped, courseTemplateId: In(courseTemplateIds) };
    }

    throw new ForbiddenException('Forbidden');
  }

  async assertCanReadMaterial(actor: DomainAccessActor, materialId: string): Promise<void> {
    if (this.isAdmin(actor)) {
      return;
    }

    const material = await this.materialRepo.findOne({ where: { id: materialId } });
    if (!material) {
      throw new NotFoundException('Material not found');
    }

    const role = normalizeRole(actor.role);
    if (role === 'student') {
      const access = await this.accessRepo.findOne({
        where: { userId: actor.sub, materialId, access: true },
      });
      if (!access) {
        throw new ForbiddenException('Cannot access this material');
      }
      return;
    }

    if (role === 'teacher') {
      const materialIds = await this.resolveTeacherMaterialIds(actor);
      if (!materialIds.includes(materialId)) {
        throw new ForbiddenException('Cannot access this material');
      }
      return;
    }

    throw new ForbiddenException('Forbidden');
  }

  private async resolveTeacherMaterialIds(actor: DomainAccessActor): Promise<string[]> {
    const courseTemplateIds = await this.resolveAccessibleCourseTemplateIds(actor);
    if (courseTemplateIds.length === 0) {
      return [];
    }

    const folders = await this.folderRepo.find({
      where: { courseTemplateId: In(courseTemplateIds) },
    });
    const folderIds = folders.map((folder) => folder.id);
    if (folderIds.length === 0) {
      return [];
    }

    const materials = await this.materialRepo.find({
      where: { folderId: In(folderIds) },
      select: ['id'],
    });
    return materials.map((row) => row.id);
  }

  private async resolveAccessibleCourseTemplateIds(actor: DomainAccessActor): Promise<string[]> {
    const role = normalizeRole(actor.role);

    if (role === 'student') {
      const student = await this.studentRepo.findOne({ where: { userId: actor.sub } });
      if (!student) {
        return [];
      }
      const enrollments = await this.enrollmentRepo.find({
        where: { studentId: student.id },
        select: ['courseTemplateId'],
      });
      return [
        ...new Set(
          enrollments.map((row) => row.courseTemplateId).filter((id): id is string => Boolean(id)),
        ),
      ];
    }

    if (role === 'teacher') {
      const teacher = await this.teacherRepo.findOne({ where: { userId: actor.sub } });
      if (!teacher) {
        return [];
      }
      const students = await this.studentRepo.find({
        where: { assignedTeacherId: teacher.id },
        select: ['id'],
      });
      if (students.length === 0) {
        return [];
      }
      const enrollments = await this.enrollmentRepo.find({
        where: { studentId: In(students.map((row) => row.id)) },
        select: ['courseTemplateId'],
      });
      return [
        ...new Set(
          enrollments.map((row) => row.courseTemplateId).filter((id): id is string => Boolean(id)),
        ),
      ];
    }

    return [];
  }
}
