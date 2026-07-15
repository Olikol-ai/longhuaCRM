import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { normalizeRole } from '../constants/roles';
import { filterToEntityWhere } from '../utils/api-record.util';
import { CertificateEntity } from '../../modules/certificates/entities/certificate.entity';
import { StudentEntity } from '../../modules/students/entities/student.entity';
import { TeacherEntity } from '../../modules/teachers/entities/teacher.entity';
import { NO_ACCESS_UUID } from './access.constants';
import { DomainAccessActor } from './domain-access.types';
import { StudentAccessService } from './student-access.service';

@Injectable()
export class CertificateAccessService {
  constructor(
    @InjectRepository(CertificateEntity)
    private readonly certificateRepo: Repository<CertificateEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    private readonly studentAccess: StudentAccessService,
  ) {}

  isAdmin(actor: DomainAccessActor): boolean {
    return normalizeRole(actor.role) === 'admin';
  }

  async scopeCertificateFilter(
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
        if (!studentIds.includes(String(scoped.studentId))) {
          throw new ForbiddenException('Forbidden');
        }
        return scoped;
      }
      return { ...scoped, studentId: In(studentIds) };
    }

    throw new ForbiddenException('Forbidden');
  }

  async assertCanReadCertificate(actor: DomainAccessActor, certificateId: string): Promise<void> {
    const certificate = await this.certificateRepo.findOne({ where: { id: certificateId } });
    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }

    if (this.isAdmin(actor)) {
      return;
    }

    await this.assertCanReadStudentCertificate(actor, certificate.studentId);
  }

  async assertCanReadStudentCertificate(
    actor: DomainAccessActor,
    studentId: string | null,
  ): Promise<void> {
    if (!studentId) {
      if (this.isAdmin(actor)) {
        return;
      }
      throw new ForbiddenException('Forbidden');
    }
    await this.studentAccess.assertCanReadStudent(actor, studentId);
  }
}
