import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { normalizeRole } from '../constants/roles';
import { DomainAccessActor } from './domain-access.types';
import { TeacherAccessService } from './teacher-access.service';
import { TutorAccessService } from './tutor-access.service';
import {
  TeacherStudentContactEntity,
  TeacherStudentContactOwnerType,
} from '../../modules/teacher-student-contacts/entities/teacher-student-contact.entity';

@Injectable()
export class TeacherStudentContactAccessService {
  constructor(
    @InjectRepository(TeacherStudentContactEntity)
    private readonly contactRepo: Repository<TeacherStudentContactEntity>,
    private readonly teacherAccess: TeacherAccessService,
    private readonly tutorAccess: TutorAccessService,
  ) {}

  isAdmin(actor: DomainAccessActor): boolean {
    return normalizeRole(actor.role) === 'admin';
  }

  async resolveOwner(
    actor: DomainAccessActor,
    preferredType?: TeacherStudentContactOwnerType,
  ): Promise<{ ownerType: TeacherStudentContactOwnerType; ownerId: string }> {
    if (preferredType === 'tutor' || normalizeRole(actor.role) === 'tutor') {
      const tutorId = await this.tutorAccess.resolveTutorId(actor);
      if (!tutorId) {
        throw new NotFoundException('Профиль репетитора не найден');
      }
      return { ownerType: 'tutor', ownerId: tutorId };
    }
    const teacherId = await this.teacherAccess.resolveTeacherId(actor);
    if (!teacherId) {
      throw new NotFoundException('Профиль преподавателя не найден');
    }
    return { ownerType: 'teacher', ownerId: teacherId };
  }

  async assertCanList(
    actor: DomainAccessActor,
    ownerType: TeacherStudentContactOwnerType,
    ownerId: string,
  ): Promise<void> {
    if (this.isAdmin(actor)) return;
    const own = await this.resolveOwner(actor, ownerType);
    if (own.ownerType !== ownerType || own.ownerId !== ownerId) {
      throw new ForbiddenException('Можно видеть только своих учеников');
    }
  }

  async assertCanWrite(
    actor: DomainAccessActor,
    contactId: string,
  ): Promise<TeacherStudentContactEntity> {
    const row = await this.contactRepo.findOne({ where: { id: contactId } });
    if (!row || row.status === 'inactive') {
      throw new NotFoundException('Запись ученика не найдена');
    }
    if (this.isAdmin(actor)) return row;
    const own = await this.resolveOwner(actor, row.ownerType);
    if (own.ownerType !== row.ownerType || own.ownerId !== row.ownerId) {
      throw new ForbiddenException('Можно изменять только свои записи учеников');
    }
    return row;
  }
}
