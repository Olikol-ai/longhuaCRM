import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Not, Repository } from 'typeorm';
import { TeacherStudentContactAccessService } from '../../common/access/teacher-student-contact-access.service';
import { JwtPayload } from '../auth/auth.service';
import { CreateTeacherStudentContactDto } from './dto/create-teacher-student-contact.dto';
import { UpdateTeacherStudentContactDto } from './dto/update-teacher-student-contact.dto';
import {
  TeacherStudentContactEntity,
  TeacherStudentContactOwnerType,
} from './entities/teacher-student-contact.entity';

@Injectable()
export class TeacherStudentContactsService {
  constructor(
    @InjectRepository(TeacherStudentContactEntity)
    private readonly contactRepo: Repository<TeacherStudentContactEntity>,
    private readonly contactAccess: TeacherStudentContactAccessService,
  ) {}

  async listMine(
    actor: JwtPayload,
    ownerType?: TeacherStudentContactOwnerType,
  ): Promise<TeacherStudentContactEntity[]> {
    if (actor.role === 'admin' && !ownerType) {
      return this.contactRepo.find({
        where: { status: Not('inactive' as TeacherStudentContactEntity['status']) },
        order: { name: 'ASC' },
      });
    }
    const owner = await this.contactAccess.resolveOwner(actor, ownerType);
    await this.contactAccess.assertCanList(actor, owner.ownerType, owner.ownerId);
    return this.contactRepo.find({
      where: {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        status: Not('inactive' as TeacherStudentContactEntity['status']),
      },
      order: { name: 'ASC' },
    });
  }

  async listForOwner(
    actor: JwtPayload,
    ownerType: TeacherStudentContactOwnerType,
    ownerId: string,
  ): Promise<TeacherStudentContactEntity[]> {
    await this.contactAccess.assertCanList(actor, ownerType, ownerId);
    return this.contactRepo.find({
      where: {
        ownerType,
        ownerId,
        status: Not('inactive' as TeacherStudentContactEntity['status']),
      },
      order: { name: 'ASC' },
    });
  }

  /**
   * Create a private notebook contact. Never creates User / Student / balance.
   */
  async create(
    actor: JwtPayload,
    dto: CreateTeacherStudentContactDto,
    ownerType?: TeacherStudentContactOwnerType,
  ): Promise<TeacherStudentContactEntity> {
    const owner = await this.contactAccess.resolveOwner(actor, ownerType);
    await this.contactAccess.assertCanList(actor, owner.ownerType, owner.ownerId);

    const name = String(dto.name || '').trim();
    if (!name) {
      throw new BadRequestException('ФИО обязательно');
    }

    return this.contactRepo.save(
      this.contactRepo.create({
        id: randomUUID(),
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        name,
        phone: this.normalizeOptional(dto.phone),
        comment: this.normalizeOptional(dto.comment ?? dto.notes),
        linkedStudentId: null,
        status: 'active',
      }),
    );
  }

  async createForOwner(
    actor: JwtPayload,
    ownerType: TeacherStudentContactOwnerType,
    ownerId: string,
    dto: CreateTeacherStudentContactDto,
  ): Promise<TeacherStudentContactEntity> {
    await this.contactAccess.assertCanList(actor, ownerType, ownerId);
    if (actor.role !== 'admin') {
      const own = await this.contactAccess.resolveOwner(actor, ownerType);
      if (own.ownerId !== ownerId || own.ownerType !== ownerType) {
        throw new BadRequestException('Нельзя создать запись для другого владельца');
      }
    }
    const name = String(dto.name || '').trim();
    if (!name) {
      throw new BadRequestException('ФИО обязательно');
    }
    return this.contactRepo.save(
      this.contactRepo.create({
        id: randomUUID(),
        ownerType,
        ownerId,
        name,
        phone: this.normalizeOptional(dto.phone),
        comment: this.normalizeOptional(dto.comment ?? dto.notes),
        linkedStudentId: null,
        status: 'active',
      }),
    );
  }

  async update(
    actor: JwtPayload,
    id: string,
    dto: UpdateTeacherStudentContactDto,
  ): Promise<TeacherStudentContactEntity> {
    const row = await this.contactAccess.assertCanWrite(actor, id);
    if (dto.name !== undefined) {
      const name = String(dto.name || '').trim();
      if (!name) {
        throw new BadRequestException('ФИО обязательно');
      }
      row.name = name;
    }
    if (dto.phone !== undefined) {
      row.phone = this.normalizeOptional(dto.phone);
    }
    if (dto.comment !== undefined || dto.notes !== undefined) {
      row.comment = this.normalizeOptional(
        dto.comment !== undefined ? dto.comment : dto.notes,
      );
    }
    return this.contactRepo.save(row);
  }

  async remove(
    actor: JwtPayload,
    id: string,
  ): Promise<{ id: string; deleted: true }> {
    const row = await this.contactAccess.assertCanWrite(actor, id);
    row.status = 'inactive';
    await this.contactRepo.save(row);
    return { id: row.id, deleted: true };
  }

  async getActiveById(id: string): Promise<TeacherStudentContactEntity | null> {
    return this.contactRepo.findOne({
      where: { id, status: Not('inactive' as TeacherStudentContactEntity['status']) },
    });
  }

  private normalizeOptional(value: unknown): string | null {
    if (value == null) return null;
    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
  }
}
