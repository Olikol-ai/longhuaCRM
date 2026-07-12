import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { normalizeRole } from '../constants/roles';
import { filterToEntityWhere } from '../utils/api-record.util';
import { EnrollmentEntity } from '../../modules/courses/entities/enrollment.entity';
import { CourseTemplateEntity } from '../../modules/courses/entities/course-template.entity';
import { StudentEntity } from '../../modules/students/entities/student.entity';
import { TeacherEntity } from '../../modules/teachers/entities/teacher.entity';
import { NO_ACCESS_UUID } from './access.constants';
import { DomainAccessActor } from './domain-access.types';
import { StudentAccessService } from './student-access.service';

@Injectable()
export class CourseAccessService {
  constructor(
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepo: Repository<EnrollmentEntity>,
    @InjectRepository(CourseTemplateEntity)
    private readonly templateRepo: Repository<CourseTemplateEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    private readonly studentAccess: StudentAccessService,
  ) {}

  isAdmin(actor: DomainAccessActor): boolean {
    return normalizeRole(actor.role) === 'admin';
  }

  async scopeEnrollmentFilter(
    actor: DomainAccessActor,
    where: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (this.isAdmin(actor)) {
      return filterToEntityWhere(where);
    }

    const role = normalizeRole(actor.role);
    if (role === 'student') {
      const studentId = await this.studentAccess.resolveStudentId(actor);
      if (!studentId) {
        return { studentId: NO_ACCESS_UUID };
      }
      return filterToEntityWhere({ ...where, student_id: studentId });
    }

    if (role === 'teacher') {
      const teacher = await this.teacherRepo.findOne({ where: { userId: actor.sub } });
      if (!teacher) {
        return { studentId: NO_ACCESS_UUID };
      }
      const students = await this.studentRepo.find({
        where: { assignedTeacherId: teacher.id },
        select: ['id'],
      });
      const studentIds = students.map((row) => row.id);
      if (studentIds.length === 0) {
        return { studentId: NO_ACCESS_UUID };
      }
      const scoped = filterToEntityWhere(where);
      if (scoped.studentId) {
        return scoped;
      }
      return { ...scoped, studentId: In(studentIds) };
    }

    throw new ForbiddenException('Forbidden');
  }

  async assertCanReadEnrollment(actor: DomainAccessActor, enrollmentId: string): Promise<void> {
    const enrollment = await this.enrollmentRepo.findOne({ where: { id: enrollmentId } });
    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    if (this.isAdmin(actor)) {
      return;
    }

    await this.studentAccess.assertCanReadStudent(actor, enrollment.studentId);
  }

  scopeTemplateFilter(
    actor: DomainAccessActor,
    where: Record<string, unknown>,
  ): Record<string, unknown> {
    if (this.isAdmin(actor)) {
      return filterToEntityWhere(where);
    }
    return filterToEntityWhere(where);
  }

  async assertCanReadTemplate(actor: DomainAccessActor, templateId: string): Promise<void> {
    const template = await this.templateRepo.findOne({ where: { id: templateId } });
    if (!template) {
      throw new NotFoundException('Course template not found');
    }

    if (this.isAdmin(actor)) {
      return;
    }

    const role = normalizeRole(actor.role);
    if (role === 'student' || role === 'teacher') {
      return;
    }

    throw new ForbiddenException('Forbidden');
  }
}
