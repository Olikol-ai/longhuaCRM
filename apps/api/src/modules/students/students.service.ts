import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { StudentAccessService } from '../../common/access/student-access.service';
import { normalizeRole } from '../../common/constants/roles';
import { JwtPayload } from '../auth/auth.service';
import { ChatMembershipSyncService } from '../chats/services/chat-membership-sync.service';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { TeacherStudentContactsService } from '../teacher-student-contacts/teacher-student-contacts.service';
import { RoleEntitySyncService } from '../users/role-entity-sync.service';
import { UsersRepository } from '../users/users.repository';
import { StudentEntity } from './entities/student.entity';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentDeleteResult, StudentDeletionService } from './student-deletion.service';
import { StudentsRepository } from './students.repository';

@Injectable()
export class StudentsService {
  constructor(
    private readonly repository: StudentsRepository,
    private readonly studentAccess: StudentAccessService,
    private readonly roleEntitySync: RoleEntitySyncService,
    private readonly usersRepository: UsersRepository,
    private readonly studentDeletion: StudentDeletionService,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    @Optional()
    private readonly teacherStudentContacts?: TeacherStudentContactsService,
    @Optional()
    private readonly chatMembershipSync?: ChatMembershipSyncService,
  ) {}

  /**
   * Students visible to the actor by access rights (admin = all, teacher = assigned).
   * Never filtered by who created the student card.
   * Admin lists also backfill school cards for teacher notebook contacts.
   */
  async findAll(actor: JwtPayload): Promise<StudentEntity[]> {
    if (this.studentAccess.isAdmin(actor) && this.teacherStudentContacts) {
      await this.teacherStudentContacts.ensureTeacherContactsLinkedToSchoolStudents();
    }
    const where = await this.studentAccess.scopeStudentFilter(actor, {});
    const rows = await this.repository.filter(where as FindOptionsWhere<StudentEntity>);
    const enriched = await this.applyUserTelegram(rows);
    return enriched.sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), 'ru', {
        sensitivity: 'base',
      }),
    );
  }

  /**
   * Active students with lesson_balance <= 2 (persisted balance column).
   * Admin-only list for the low-balance dashboard screen.
   */
  async findLowBalance(): Promise<StudentEntity[]> {
    const rows = await this.repository.findActiveWithLowBalance();
    return this.applyUserTelegram(rows);
  }

  /**
   * Dropdown for school payments — access by assignment/role, never by creator.
   */
  async findPaymentOptions(actor: JwtPayload): Promise<StudentEntity[]> {
    if (this.studentAccess.isAdmin(actor) && this.teacherStudentContacts) {
      await this.teacherStudentContacts.ensureTeacherContactsLinkedToSchoolStudents();
    }
    const rows = await this.studentAccess.listStudentsForPayments(actor);
    return this.applyUserTelegram(rows);
  }

  async findById(actor: JwtPayload, id: string): Promise<StudentEntity> {
    await this.studentAccess.assertCanReadStudent(actor, id);
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundException('Student not found');
    }
    const [enriched] = await this.applyUserTelegram([row]);
    return enriched;
  }

  async create(actor: JwtPayload, dto: CreateStudentDto): Promise<StudentEntity> {
    const payload: Record<string, unknown> = { ...dto };
    const role = normalizeRole(actor.role);

    if (role === 'teacher') {
      const teacher = await this.teacherRepo.findOne({ where: { userId: actor.sub } });
      if (!teacher) {
        throw new ForbiddenException('Профиль преподавателя не найден');
      }
      // Payment / notebook access follows assignment, not authorship.
      // Teacher-created school cards are always assigned to that teacher.
      payload.assignedTeacherId = teacher.id;
      if (!payload.status) {
        payload.status = 'active';
      }
    } else if (role !== 'admin') {
      throw new ForbiddenException('Forbidden');
    }

    if (dto.email?.trim() && !dto.userId) {
      const user = await this.usersRepository.findByEmail(dto.email.trim().toLowerCase());
      if (user) {
        payload.userId = user.id;
      }
    }

    const student = await this.roleEntitySync.upsertStudentFromCreate(payload);
    if (this.chatMembershipSync) {
      await this.chatMembershipSync.syncSubjectChatsForStudent(student.id);
    }
    return student;
  }

  async update(actor: JwtPayload, id: string, dto: UpdateStudentDto): Promise<StudentEntity> {
    const payload = await this.studentAccess.assertCanUpdateStudent(
      actor,
      id,
      dto as Record<string, unknown>,
    );

    const normalized: Record<string, unknown> = { ...payload };
    if (
      Object.prototype.hasOwnProperty.call(normalized, 'assignedTeacherId')
      && (normalized.assignedTeacherId === '' || normalized.assignedTeacherId === undefined)
    ) {
      normalized.assignedTeacherId = null;
    }
    if (
      Object.prototype.hasOwnProperty.call(normalized, 'assignedTutorId')
      && (normalized.assignedTutorId === '' || normalized.assignedTutorId === undefined)
    ) {
      normalized.assignedTutorId = null;
    }

    // Admin assigned a teacher → leave the "awaiting assignment" queue.
    if (
      Object.prototype.hasOwnProperty.call(normalized, 'assignedTeacherId')
      && normalized.assignedTeacherId
      && !Object.prototype.hasOwnProperty.call(normalized, 'status')
    ) {
      const current = await this.repository.findById(id);
      if (current?.status === 'pending_assignment') {
        normalized.status = 'active';
      }
    }
    // Cleared teacher without explicit status → back to awaiting assignment.
    if (
      Object.prototype.hasOwnProperty.call(normalized, 'assignedTeacherId')
      && normalized.assignedTeacherId === null
      && !Object.prototype.hasOwnProperty.call(normalized, 'status')
    ) {
      const current = await this.repository.findById(id);
      if (current && current.status === 'active') {
        normalized.status = 'pending_assignment';
      }
    }
    if (
      Object.prototype.hasOwnProperty.call(normalized, 'email')
      && typeof normalized.email === 'string'
      && normalized.email.trim() === ''
    ) {
      normalized.email = null;
    }

    const row = await this.repository.update(id, normalized as UpdateStudentDto);
    if (!row) {
      throw new NotFoundException('Student not found');
    }

    const nameTouched =
      normalized.name !== undefined ||
      normalized.firstName !== undefined ||
      normalized.lastName !== undefined;

    let result = row;
    if (nameTouched) {
      // Admin-edited `name` is SSOT — re-split first/last so schedule labels stay in sync.
      const nameIsSource = normalized.name !== undefined;
      this.roleEntitySync.normalizeStudentNameFields(row, { nameIsSource });
      const saved = await this.repository.update(id, {
        name: row.name,
        firstName: row.firstName,
        lastName: row.lastName,
      });
      const synced = saved ?? row;
      await this.roleEntitySync.syncLinkedUserFromStudent(synced);
      result = synced;
    }

    // One-way: Student name/phone/notes → contact labels (not lesson_balance).
    const profileTouched =
      nameTouched ||
      Object.prototype.hasOwnProperty.call(normalized, 'phone') ||
      Object.prototype.hasOwnProperty.call(normalized, 'notes');
    if (profileTouched && this.teacherStudentContacts) {
      await this.teacherStudentContacts.syncLinkedContactProfileFromStudent(result);
    }

    const subjectRelevant =
      Object.prototype.hasOwnProperty.call(normalized, 'assignedTeacherId')
      || Object.prototype.hasOwnProperty.call(normalized, 'assignedTutorId')
      || Object.prototype.hasOwnProperty.call(normalized, 'status')
      || Object.prototype.hasOwnProperty.call(normalized, 'userId');
    if (subjectRelevant && this.chatMembershipSync) {
      await this.chatMembershipSync.syncSubjectChatsForStudent(result.id);
    }

    if (
      this.teacherStudentContacts &&
      Object.prototype.hasOwnProperty.call(normalized, 'assignedTeacherId') &&
      typeof result.assignedTeacherId === 'string' &&
      result.assignedTeacherId
    ) {
      await this.teacherStudentContacts.syncTeacherOwnerFromLinkedStudent(
        result.id,
        result.assignedTeacherId,
      );
    }

    return result;
  }

  delete(id: string): Promise<StudentDeleteResult> {
    return this.studentDeletion.deleteStudent(id);
  }

  async filter(actor: JwtPayload, where: Record<string, unknown>): Promise<StudentEntity[]> {
    if (this.studentAccess.isAdmin(actor) && this.teacherStudentContacts) {
      await this.teacherStudentContacts.ensureTeacherContactsLinkedToSchoolStudents();
    }
    const scoped = await this.studentAccess.scopeStudentFilter(actor, where);
    const rows = await this.repository.filter(scoped as FindOptionsWhere<StudentEntity>);
    return this.applyUserTelegram(rows);
  }

  /** Prefer linked User.telegram_id for API responses (source of truth). */
  private async applyUserTelegram(rows: StudentEntity[]): Promise<StudentEntity[]> {
    const userIds = [
      ...new Set(rows.map((row) => row.userId).filter((id): id is string => Boolean(id))),
    ];
    if (userIds.length === 0) {
      return rows;
    }

    const users = await Promise.all(
      userIds.map((id) => this.usersRepository.findById(id)),
    );
    const byId = new Map(
      users
        .filter((user): user is NonNullable<typeof user> => Boolean(user))
        .map((user) => [user.id, user]),
    );

    for (const row of rows) {
      if (!row.userId) continue;
      const user = byId.get(row.userId);
      const telegramId = (user?.telegramId ?? '').trim();
      if (!telegramId) continue;
      row.telegramId = telegramId;
      row.telegramUsername = (user?.telegramUsername ?? '').trim() || row.telegramUsername;
      row.telegramConnectedAt = user?.telegramConnectedAt ?? row.telegramConnectedAt;
    }
    return rows;
  }
}
