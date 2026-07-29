import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, In, Not, Repository } from 'typeorm';
import { TeacherStudentContactAccessService } from '../../common/access/teacher-student-contact-access.service';
import { JwtPayload } from '../auth/auth.service';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { CreateTeacherStudentContactDto } from './dto/create-teacher-student-contact.dto';
import { UpdateTeacherStudentContactBalanceDto } from './dto/update-teacher-student-contact-balance.dto';
import { UpdateTeacherStudentContactDto } from './dto/update-teacher-student-contact.dto';
import { TeacherStudentBalanceHistoryEntity } from './entities/teacher-student-balance-history.entity';
import {
  TeacherStudentContactEntity,
  TeacherStudentContactOwnerType,
} from './entities/teacher-student-contact.entity';
import { TeacherStudentContactBalanceService } from './teacher-student-contact-balance.service';

export type TeacherStudentContactListItem = TeacherStudentContactEntity & {
  lastLessonDate: string | null;
  lastLessonStartTime: string | null;
};

export type TeacherStudentContactDetail = TeacherStudentContactListItem & {
  lessons: Array<{
    id: string;
    date: string;
    startTime: string;
    duration: number;
    status: string;
    lessonFormat: string | null;
  }>;
  balanceHistory: TeacherStudentBalanceHistoryEntity[];
};

@Injectable()
export class TeacherStudentContactsService {
  constructor(
    @InjectRepository(TeacherStudentContactEntity)
    private readonly contactRepo: Repository<TeacherStudentContactEntity>,
    @InjectRepository(TeacherStudentBalanceHistoryEntity)
    private readonly historyRepo: Repository<TeacherStudentBalanceHistoryEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly contactAccess: TeacherStudentContactAccessService,
    private readonly balanceService: TeacherStudentContactBalanceService,
  ) {}

  async listMine(
    actor: JwtPayload,
    ownerType?: TeacherStudentContactOwnerType,
  ): Promise<TeacherStudentContactListItem[]> {
    let rows: TeacherStudentContactEntity[];
    if (actor.role === 'admin' && !ownerType) {
      rows = await this.contactRepo.find({
        where: { status: Not('inactive' as TeacherStudentContactEntity['status']) },
        order: { name: 'ASC' },
      });
    } else {
      const owner = await this.contactAccess.resolveOwner(actor, ownerType);
      await this.contactAccess.assertCanList(actor, owner.ownerType, owner.ownerId);
      rows = await this.contactRepo.find({
        where: {
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          status: Not('inactive' as TeacherStudentContactEntity['status']),
        },
        order: { name: 'ASC' },
      });
    }
    return this.attachLastLessons(rows);
  }

  async listForOwner(
    actor: JwtPayload,
    ownerType: TeacherStudentContactOwnerType,
    ownerId: string,
  ): Promise<TeacherStudentContactListItem[]> {
    await this.contactAccess.assertCanList(actor, ownerType, ownerId);
    const rows = await this.contactRepo.find({
      where: {
        ownerType,
        ownerId,
        status: Not('inactive' as TeacherStudentContactEntity['status']),
      },
      order: { name: 'ASC' },
    });
    return this.attachLastLessons(rows);
  }

  /**
   * Create a private notebook contact. Never creates User / Student / school payment.
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
        lessonBalance: 0,
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
        lessonBalance: 0,
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

  async updateBalance(
    actor: JwtPayload,
    id: string,
    dto: UpdateTeacherStudentContactBalanceDto,
  ): Promise<TeacherStudentContactEntity> {
    const row = await this.contactAccess.assertCanWrite(actor, id);
    const newBalance = Number(dto.newBalance);
    if (!Number.isInteger(newBalance) || newBalance < 0) {
      throw new BadRequestException('Баланс должен быть целым числом ≥ 0');
    }
    return this.dataSource.transaction(async (manager) => {
      const locked = await manager.getRepository(TeacherStudentContactEntity).findOne({
        where: { id: row.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked || locked.status === 'inactive') {
        throw new NotFoundException('Запись ученика не найдена');
      }
      return this.balanceService.applyManualBalance(
        manager,
        locked,
        newBalance,
        this.normalizeOptional(dto.reason),
        actor.sub,
      );
    });
  }

  async getDetail(
    actor: JwtPayload,
    id: string,
  ): Promise<TeacherStudentContactDetail> {
    const row = await this.contactAccess.assertCanWrite(actor, id);
    const [enriched] = await this.attachLastLessons([row]);
    const lessons = await this.dataSource.getRepository(LessonEntity).find({
      where: { primaryTeacherStudentContactId: id },
      order: { date: 'DESC', startTime: 'DESC' },
      take: 100,
    });
    const balanceHistory = await this.historyRepo.find({
      where: { studentContactId: id },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return {
      ...enriched,
      lessons: lessons.map((l) => ({
        id: l.id,
        date: l.date,
        startTime: l.startTime,
        duration: l.duration,
        status: l.status,
        lessonFormat: l.lessonFormat ?? null,
      })),
      balanceHistory,
    };
  }

  async listBalanceHistory(
    actor: JwtPayload,
    id: string,
  ): Promise<TeacherStudentBalanceHistoryEntity[]> {
    await this.contactAccess.assertCanWrite(actor, id);
    return this.historyRepo.find({
      where: { studentContactId: id },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  /**
   * Soft-archive a manual contact (never hard-delete: keeps lesson/balance history).
   * Cancels planned lessons for this contact so the schedule stays consistent.
   * Refuses if the contact is linked to a registered CRM User.
   */
  async remove(
    actor: JwtPayload,
    id: string,
  ): Promise<{
    id: string;
    deleted: true;
    cancelledLessons: number;
    archived: true;
  }> {
    const row = await this.contactAccess.assertCanWrite(actor, id);

    if (row.linkedStudentId) {
      const linked = await this.dataSource.getRepository(StudentEntity).findOne({
        where: { id: row.linkedStudentId },
        select: ['id', 'userId'],
      });
      if (linked?.userId) {
        throw new BadRequestException(
          'Нельзя удалить запись, связанную с зарегистрированным учеником',
        );
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const contactRepo = manager.getRepository(TeacherStudentContactEntity);
      const lessonRepo = manager.getRepository(LessonEntity);

      const planned = await lessonRepo.find({
        where: {
          primaryTeacherStudentContactId: row.id,
          status: 'planned',
        },
        select: ['id'],
      });
      if (planned.length > 0) {
        await lessonRepo.update(
          { id: In(planned.map((lesson) => lesson.id)) },
          { status: 'cancelled' },
        );
      }

      row.status = 'inactive';
      await contactRepo.save(row);

      return {
        id: row.id,
        deleted: true as const,
        archived: true as const,
        cancelledLessons: planned.length,
      };
    });
  }

  async getActiveById(id: string): Promise<TeacherStudentContactEntity | null> {
    return this.contactRepo.findOne({
      where: { id, status: Not('inactive' as TeacherStudentContactEntity['status']) },
    });
  }

  private async attachLastLessons(
    rows: TeacherStudentContactEntity[],
  ): Promise<TeacherStudentContactListItem[]> {
    if (rows.length === 0) {
      return [];
    }
    const ids = rows.map((r) => r.id);
    const lessons = await this.dataSource.getRepository(LessonEntity).find({
      where: { primaryTeacherStudentContactId: In(ids) },
      select: ['id', 'primaryTeacherStudentContactId', 'date', 'startTime', 'status'],
      order: { date: 'DESC', startTime: 'DESC' },
    });
    const lastByContact = new Map<string, { date: string; startTime: string }>();
    for (const lesson of lessons) {
      const cid = lesson.primaryTeacherStudentContactId;
      if (!cid || lastByContact.has(cid)) continue;
      lastByContact.set(cid, { date: lesson.date, startTime: lesson.startTime });
    }
    return rows.map((row) => {
      const last = lastByContact.get(row.id);
      return Object.assign(row, {
        lastLessonDate: last?.date ?? null,
        lastLessonStartTime: last?.startTime ?? null,
      });
    });
  }

  private normalizeOptional(value: unknown): string | null {
    if (value == null) return null;
    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
  }
}
