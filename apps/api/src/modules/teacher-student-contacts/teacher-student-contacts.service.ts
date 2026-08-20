import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, In, IsNull, Not, Repository } from 'typeorm';
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
import { TutorContactBalanceEntity } from './entities/tutor-contact-balance.entity';
import { TeacherStudentContactBalanceService } from './teacher-student-contact-balance.service';

export type TeacherStudentContactListItem = Omit<
  TeacherStudentContactEntity,
  never
> & {
  /** Resolved balance for API: Student (teacher) or tutor_contact_balances (tutor). */
  lessonBalance: number;
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
    // Heal dual-column drift before any notebook / schedule / payments UI reads balance.
    if (actor.role === 'admin' || actor.role === 'teacher') {
      await this.ensureTeacherContactsLinkedToSchoolStudents();
    }

    let rows: TeacherStudentContactEntity[];
    if (actor.role === 'admin') {
      // Admin: all contacts, optionally filtered by ownerType (e.g. teacher-only for payments).
      rows = await this.contactRepo.find({
        where: {
          status: Not('inactive' as TeacherStudentContactEntity['status']),
          ...(ownerType ? { ownerType } : {}),
        },
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
   * Create a notebook contact.
   * Teachers: also creates a linked school Student (admin-visible).
   * Tutors: private contact only (no school Student).
   */
  async create(
    actor: JwtPayload,
    dto: CreateTeacherStudentContactDto,
    ownerType?: TeacherStudentContactOwnerType,
  ): Promise<TeacherStudentContactEntity> {
    const owner = await this.contactAccess.resolveOwner(actor, ownerType);
    await this.contactAccess.assertCanList(actor, owner.ownerType, owner.ownerId);
    return this.createContactWithOptionalSchoolLink(
      owner.ownerType,
      owner.ownerId,
      dto,
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
    return this.createContactWithOptionalSchoolLink(ownerType, ownerId, dto);
  }

  /**
   * Backfill: teacher contacts without linked_student_id get a school Student card
   * so admins see them in Ученики / Платежи / карточки.
   * Academic balance lives only on Student — contacts have no balance column.
   */
  async ensureTeacherContactsLinkedToSchoolStudents(): Promise<number> {
    const unlinked = await this.contactRepo.find({
      where: {
        ownerType: 'teacher',
        linkedStudentId: IsNull(),
        status: Not('inactive' as TeacherStudentContactEntity['status']),
      },
      order: { createdAt: 'ASC' },
    });

    let linked = 0;
    for (const contact of unlinked) {
      await this.dataSource.transaction(async (manager) => {
        const locked = await manager.getRepository(TeacherStudentContactEntity).findOne({
          where: { id: contact.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!locked || locked.linkedStudentId || locked.status === 'inactive') {
          return;
        }
        if (locked.ownerType !== 'teacher') {
          return;
        }
        const student = await this.createSchoolStudentForTeacherContact(
          manager,
          locked.ownerId,
          locked.name,
          locked.phone,
          locked.comment,
          0,
        );
        locked.linkedStudentId = student.id;
        await manager.getRepository(TeacherStudentContactEntity).save(locked);
        linked += 1;
      });
    }

    return linked;
  }

  /** When admin reassigns a school student, keep the teacher notebook owner in sync. */
  async syncTeacherOwnerFromLinkedStudent(
    studentId: string,
    teacherId: string | null,
  ): Promise<void> {
    if (!studentId || !teacherId) {
      return;
    }
    await this.contactRepo.update(
      { linkedStudentId: studentId, ownerType: 'teacher' },
      { ownerId: teacherId },
    );
  }

  /**
   * One-way: school Student name/phone/notes → linked teacher contact labels.
   * Never syncs lesson balance (Student is SSOT; contacts have no balance column).
   */
  async syncLinkedContactProfileFromStudent(student: {
    id: string;
    name?: string | null;
    phone?: string | null;
    notes?: string | null;
  }): Promise<void> {
    if (!student?.id) {
      return;
    }
    await this.contactRepo.update(
      { linkedStudentId: student.id, ownerType: 'teacher' },
      {
        name: String(student.name || '').trim() || 'Без имени',
        phone: student.phone ?? null,
        comment: student.notes ?? null,
      },
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
    const saved = await this.contactRepo.save(row);
    if (saved.linkedStudentId) {
      await this.dataSource.getRepository(StudentEntity).update(
        { id: saved.linkedStudentId },
        {
          name: saved.name,
          phone: saved.phone,
          notes: saved.comment,
        },
      );
    }
    return saved;
  }

  async updateBalance(
    actor: JwtPayload,
    id: string,
    dto: UpdateTeacherStudentContactBalanceDto,
  ): Promise<TeacherStudentContactEntity> {
    const row = await this.contactAccess.assertCanWrite(actor, id);
    const newBalance = Number(dto.newBalance);
    if (!Number.isInteger(newBalance)) {
      throw new BadRequestException(
        'Баланс должен быть целым числом (допускается отрицательный — задолженность)',
      );
    }
    const updated = await this.dataSource.transaction(async (manager) => {
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
    const [enriched] = await this.attachLastLessons([updated]);
    return enriched;
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

      if (row.linkedStudentId) {
        const linked = await manager.getRepository(StudentEntity).findOne({
          where: { id: row.linkedStudentId },
          select: ['id', 'userId'],
        });
        if (linked && !linked.userId) {
          await manager.getRepository(StudentEntity).update(
            { id: linked.id },
            { status: 'inactive' },
          );
        }
      }

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

    // Overlay school Student fields (SSOT) onto linked teacher contacts.
    // Tutors: pack balance from tutor_contact_balances.
    const linkedIds = [
      ...new Set(
        rows
          .filter((r) => r.ownerType === 'teacher' && r.linkedStudentId)
          .map((r) => r.linkedStudentId as string),
      ),
    ];
    const schoolById = new Map<
      string,
      { lessonBalance: number; name: string; phone: string | null; notes: string | null }
    >();
    if (linkedIds.length > 0) {
      const linkedStudents = await this.dataSource.getRepository(StudentEntity).find({
        where: { id: In(linkedIds) },
        select: ['id', 'lessonBalance', 'name', 'phone', 'notes'],
      });
      for (const student of linkedStudents) {
        schoolById.set(student.id, {
          lessonBalance: student.lessonBalance ?? 0,
          name: student.name,
          phone: student.phone ?? null,
          notes: student.notes ?? null,
        });
      }
    }

    const tutorContactIds = rows
      .filter((r) => r.ownerType === 'tutor')
      .map((r) => r.id);
    const tutorBalanceById = new Map<string, number>();
    if (tutorContactIds.length > 0) {
      const tutorBalances = await this.dataSource
        .getRepository(TutorContactBalanceEntity)
        .find({ where: { contactId: In(tutorContactIds) } });
      for (const row of tutorBalances) {
        tutorBalanceById.set(row.contactId, row.lessonBalance ?? 0);
      }
    }

    return rows.map((row) => {
      const last = lastByContact.get(row.id);
      const school =
        row.ownerType === 'teacher' && row.linkedStudentId
          ? schoolById.get(row.linkedStudentId)
          : undefined;
      // Plain DTO: teachers → Student; tutors → tutor_contact_balances.
      const lessonBalance =
        school !== undefined
          ? school.lessonBalance
          : row.ownerType === 'tutor'
            ? (tutorBalanceById.get(row.id) ?? 0)
            : 0;
      return {
        id: row.id,
        ownerType: row.ownerType,
        ownerId: row.ownerId,
        name: school?.name ?? row.name,
        phone: school ? school.phone : row.phone,
        comment: school ? school.notes : row.comment,
        lessonBalance,
        linkedStudentId: row.linkedStudentId,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        lastLessonDate: last?.date ?? null,
        lastLessonStartTime: last?.startTime ?? null,
      } as TeacherStudentContactListItem;
    });
  }

  private normalizeOptional(value: unknown): string | null {
    if (value == null) return null;
    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
  }

  private async createContactWithOptionalSchoolLink(
    ownerType: TeacherStudentContactOwnerType,
    ownerId: string,
    dto: CreateTeacherStudentContactDto,
  ): Promise<TeacherStudentContactEntity> {
    const name = String(dto.name || '').trim();
    if (!name) {
      throw new BadRequestException('ФИО обязательно');
    }
    const phone = this.normalizeOptional(dto.phone);
    const comment = this.normalizeOptional(dto.comment ?? dto.notes);

    if (ownerType !== 'teacher') {
      return this.dataSource.transaction(async (manager) => {
        const contactRepo = manager.getRepository(TeacherStudentContactEntity);
        const saved = await contactRepo.save(
          contactRepo.create({
            id: randomUUID(),
            ownerType,
            ownerId,
            name,
            phone,
            comment,
            linkedStudentId: null,
            status: 'active',
          }),
        );
        await this.balanceService.ensureTutorBalanceRow(manager, saved.id, 0);
        return saved;
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const student = await this.createSchoolStudentForTeacherContact(
        manager,
        ownerId,
        name,
        phone,
        comment,
        0,
      );
      const contactRepo = manager.getRepository(TeacherStudentContactEntity);
      return contactRepo.save(
        contactRepo.create({
          id: randomUUID(),
          ownerType: 'teacher',
          ownerId,
          name,
          phone,
          comment,
          linkedStudentId: student.id,
          status: 'active',
        }),
      );
    });
  }

  private async createSchoolStudentForTeacherContact(
    manager: EntityManager,
    teacherId: string,
    name: string,
    phone: string | null,
    comment: string | null,
    lessonBalance = 0,
  ): Promise<StudentEntity> {
    const studentRepo = manager.getRepository(StudentEntity);
    const student = studentRepo.create({
      id: randomUUID(),
      name,
      phone,
      notes: comment,
      assignedTeacherId: teacherId,
      status: 'active',
      lessonBalance,
      email: null,
      userId: null,
    });
    return studentRepo.save(student);
  }
}
