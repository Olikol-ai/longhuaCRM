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
import { ChatMembershipSyncService } from '../chats/services/chat-membership-sync.service';

@Injectable()
export class CoursesService {
  constructor(
    private readonly repository: CoursesRepository,
    private readonly courseAccess: CourseAccessService,
    private readonly enrollmentProgress: EnrollmentProgressService,
    private readonly chatMembershipSync: ChatMembershipSyncService,
  ) {}

  async findAllTemplates(actor: JwtPayload): Promise<CourseTemplateEntity[]> {
    // Active catalog only — archived courses stay in DB for enrollments/certs/history.
    const where = this.courseAccess.scopeTemplateFilter(actor, { is_active: true });
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
    return this.nextCourseSortOrder().then(async (sortOrder) => {
      const template = await this.repository.saveTemplate({
        name: dto.name,
        courseType: dto.courseType ?? 'basic_beginner',
        totalLessons: dto.totalLessons ?? 35,
        sortOrder: dto.sortOrder ?? sortOrder,
        description: dto.description ?? null,
        // DB column price is NOT NULL — materials UI creates courses by name only.
        price: dto.price ?? 0,
        isActive: dto.isActive ?? true,
      });
      await this.chatMembershipSync.assignDefaultCourseSubject(template.id);
      return template;
    });
  }

  private async nextCourseSortOrder(): Promise<number> {
    const rows = await this.repository.filterTemplates({ isActive: true });
    if (rows.length === 0) return 0;
    return Math.max(...rows.map((row) => row.sortOrder ?? 0)) + 1;
  }

  async updateTemplate(id: string, dto: UpdateCourseTemplateDto): Promise<CourseTemplateEntity> {
    const row = await this.repository.updateTemplate(id, dto);
    if (!row) {
      throw new NotFoundException('Course template not found');
    }
    return row;
  }

  /**
   * Soft-delete (archive) course from the Materials catalog.
   * Admin-only via controller. Keeps enrollments/certificates/history.
   * Soft-deletes course materials and clears related access/grants.
   */
  async deleteTemplate(id: string): Promise<CourseTemplateEntity> {
    const row = await this.repository.findTemplateById(id);
    if (!row) {
      throw new NotFoundException('Course template not found');
    }
    if (!row.isActive) {
      return row;
    }
    return this.repository.archiveTemplate(id);
  }

  async filterTemplates(
    actor: JwtPayload,
    where: Record<string, unknown>,
  ): Promise<CourseTemplateEntity[]> {
    const scoped = this.courseAccess.scopeTemplateFilter(actor, where);
    // Default to active catalog unless caller explicitly filters is_active / isActive.
    if (scoped.isActive === undefined) {
      scoped.isActive = true;
    }
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

  async createEnrollment(dto: CreateEnrollmentDto): Promise<EnrollmentEntity> {
    const enrollment = await this.repository.saveEnrollment(dto);
    await this.chatMembershipSync.syncAfterEnrollment(enrollment);
    return enrollment;
  }

  async updateEnrollment(id: string, dto: UpdateEnrollmentDto): Promise<EnrollmentEntity> {
    const row = await this.repository.updateEnrollment(id, dto);
    if (!row) {
      throw new NotFoundException('Enrollment not found');
    }
    await this.chatMembershipSync.syncAfterEnrollment(row);
    return row;
  }

  async deleteEnrollment(id: string): Promise<void> {
    const row = await this.repository.findEnrollmentById(id);
    if (!row) {
      throw new NotFoundException('Enrollment not found');
    }
    const studentId = row.studentId;
    await this.repository.deleteEnrollment(id);
    if (studentId) {
      await this.chatMembershipSync.syncSubjectChatsForStudent(studentId);
    }
  }

  async filterEnrollments(
    actor: JwtPayload,
    where: Record<string, unknown>,
  ): Promise<EnrollmentEntity[]> {
    const scoped = await this.courseAccess.scopeEnrollmentFilter(actor, where);
    return this.repository.filterEnrollments(scoped as FindOptionsWhere<EnrollmentEntity>);
  }
}
