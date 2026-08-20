import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { normalizeRole } from '../constants/roles';
import { filterToEntityWhere } from '../utils/api-record.util';
import { StudentEntity } from '../../modules/students/entities/student.entity';
import { TeacherEntity } from '../../modules/teachers/entities/teacher.entity';
import { NO_ACCESS_UUID } from './access.constants';
import { DomainAccessActor, STUDENT_SELF_UPDATE_FIELDS } from './domain-access.types';

@Injectable()
export class StudentAccessService {
  constructor(
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
  ) {}

  isAdmin(actor: DomainAccessActor): boolean {
    return normalizeRole(actor.role) === 'admin';
  }

  async resolveStudentId(actor: DomainAccessActor): Promise<string | null> {
    const row = await this.studentRepo.findOne({ where: { userId: actor.sub } });
    return row?.id ?? null;
  }

  async scopeStudentFilter(
    actor: DomainAccessActor,
    where: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (this.isAdmin(actor)) {
      return filterToEntityWhere(where);
    }

    const role = normalizeRole(actor.role);
    if (role === 'student') {
      const studentId = await this.resolveStudentId(actor);
      if (!studentId) {
        return { id: NO_ACCESS_UUID };
      }
      return { id: studentId };
    }

    if (role === 'teacher') {
      const teacher = await this.teacherRepo.findOne({ where: { userId: actor.sub } });
      if (!teacher) {
        return { assignedTeacherId: NO_ACCESS_UUID };
      }
      const scoped = filterToEntityWhere({ ...where, assigned_teacher: teacher.id });
      // Inactive CRM shells (e.g. former student → tutor) keep assignedTeacherId for
      // referral history but must never appear in the teacher's live notebook.
      if (scoped.status === undefined) {
        scoped.status = Not('inactive');
      }
      return scoped;
    }

    // Tutors must use /tutors/:id/students (tutor_students), never school students.
    if (role === 'tutor' || role === 'tutor_student') {
      throw new ForbiddenException('Школьные ученики недоступны для репетиторов');
    }

    throw new ForbiddenException('Forbidden');
  }

  async assertCanReadStudent(actor: DomainAccessActor, studentId: string | null): Promise<void> {
    if (!studentId) {
      if (this.isAdmin(actor)) {
        return;
      }
      throw new ForbiddenException('Forbidden');
    }

    if (this.isAdmin(actor)) {
      return;
    }

    const student = await this.studentRepo.findOne({ where: { id: studentId } });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const role = normalizeRole(actor.role);
    if (role === 'student') {
      if (student.userId !== actor.sub) {
        throw new ForbiddenException('Cannot access another student profile');
      }
      return;
    }

    if (role === 'teacher') {
      const teacher = await this.teacherRepo.findOne({ where: { userId: actor.sub } });
      if (!teacher || student.assignedTeacherId !== teacher.id) {
        throw new ForbiddenException('Cannot access students outside your assignment');
      }
      return;
    }

    throw new ForbiddenException('Forbidden');
  }

  async assertCanUpdateStudent<T extends Record<string, unknown>>(
    actor: DomainAccessActor,
    studentId: string,
    dto: T,
  ): Promise<Partial<T>> {
    await this.assertCanReadStudent(actor, studentId);

    if (this.isAdmin(actor)) {
      return dto;
    }

    if (normalizeRole(actor.role) === 'student') {
      return this.pickFields(dto, STUDENT_SELF_UPDATE_FIELDS);
    }

    throw new ForbiddenException('Forbidden');
  }

  /**
   * Payment access follows access to the student (role + assignment),
   * never who created the student card (no createdBy / owner of the row).
   */
  async scopePaymentFilter(
    actor: DomainAccessActor,
    where: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (this.isAdmin(actor)) {
      return filterToEntityWhere(where);
    }

    const role = normalizeRole(actor.role);

    if (role === 'student') {
      const studentId = await this.resolveStudentId(actor);
      if (!studentId) {
        return { studentId: NO_ACCESS_UUID };
      }
      return filterToEntityWhere({ ...where, student_id: studentId });
    }

    if (role === 'teacher') {
      const allowedIds = await this.resolveTeacherAssignedStudentIds(actor);
      if (allowedIds.length === 0) {
        return { studentId: NO_ACCESS_UUID };
      }

      const scoped = filterToEntityWhere(where);
      const requested = scoped.studentId;
      if (typeof requested === 'string') {
        if (!allowedIds.includes(requested)) {
          return { studentId: NO_ACCESS_UUID };
        }
        return scoped;
      }
      return { ...scoped, studentId: In(allowedIds) };
    }

    // Tutors use private notebook balance (/teacher-student-contacts), not school payments.
    throw new ForbiddenException('Forbidden');
  }

  /**
   * Students selectable when creating/editing a school payment.
   * Admin: every school student. Teacher: assigned students only.
   * Explicitly ignores authorship of the student row.
   */
  async listStudentsForPayments(actor: DomainAccessActor): Promise<StudentEntity[]> {
    if (this.isAdmin(actor)) {
      return this.studentRepo.find({
        order: { name: 'ASC' },
      });
    }

    if (normalizeRole(actor.role) === 'teacher') {
      const teacher = await this.teacherRepo.findOne({ where: { userId: actor.sub } });
      if (!teacher) {
        return [];
      }
      return this.studentRepo.find({
        where: {
          assignedTeacherId: teacher.id,
          status: Not('inactive'),
        },
        order: { name: 'ASC' },
      });
    }

    throw new ForbiddenException('Forbidden');
  }

  async assertCanReadPayment(
    actor: DomainAccessActor,
    studentId: string | null,
  ): Promise<void> {
    // Same gate as reading the student: admin / assigned teacher / self.
    await this.assertCanReadStudent(actor, studentId);
  }

  /**
   * Create / update school payments. Admin: any student. Teacher: assigned students only.
   * Students and tutors cannot mutate school payments.
   */
  async assertCanWritePayment(
    actor: DomainAccessActor,
    studentId: string | null,
  ): Promise<void> {
    if (!studentId) {
      throw new ForbiddenException('Payment must be linked to a student');
    }

    if (this.isAdmin(actor)) {
      const student = await this.studentRepo.findOne({ where: { id: studentId } });
      if (!student) {
        throw new NotFoundException('Student not found');
      }
      return;
    }

    if (normalizeRole(actor.role) === 'teacher') {
      await this.assertCanReadStudent(actor, studentId);
      return;
    }

    throw new ForbiddenException('Forbidden');
  }

  private async resolveTeacherAssignedStudentIds(
    actor: DomainAccessActor,
  ): Promise<string[]> {
    const teacher = await this.teacherRepo.findOne({ where: { userId: actor.sub } });
    if (!teacher) {
      return [];
    }
    const rows = await this.studentRepo.find({
      where: { assignedTeacherId: teacher.id },
      select: ['id'],
    });
    return rows.map((row) => row.id);
  }

  private pickFields<T extends Record<string, unknown>>(
    dto: T,
    allowed: readonly string[],
  ): Partial<T> {
    const out: Partial<T> = {};
    for (const key of allowed) {
      if (dto[key as keyof T] !== undefined) {
        out[key as keyof T] = dto[key as keyof T];
      }
    }
    return out;
  }
}
