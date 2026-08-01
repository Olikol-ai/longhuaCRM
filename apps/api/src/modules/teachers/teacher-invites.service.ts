import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { JwtPayload } from '../auth/auth.service';
import { TeacherAccessService } from '../../common/access/teacher-access.service';
import { normalizeRole } from '../../common/constants/roles';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherInviteLinkEntity } from './entities/teacher-invite-link.entity';

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TeacherInviteListItem = TeacherInviteLinkEntity & {
  /** Live count: students still assigned to this teacher with User.role = student. */
  activeStudentsCount: number;
};

export type TeacherInviteEnsureResult = {
  id: string;
  /** Public ref for /register?ref= — stable invite id (recoverable from list). */
  token: string;
  expiresAt: Date;
  label: string | null;
  created: boolean;
};

@Injectable()
export class TeacherInvitesService {
  constructor(
    @InjectRepository(TeacherInviteLinkEntity)
    private readonly inviteRepo: Repository<TeacherInviteLinkEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    private readonly teacherAccess: TeacherAccessService,
  ) {}

  /**
   * Idempotent public link for a teacher: reuse the single non-revoked row,
   * create only when none exists. Never inserts a second active link.
   */
  async ensureMine(
    actor: JwtPayload,
    label?: string,
  ): Promise<TeacherInviteEnsureResult> {
    const teacherId = await this.resolveTeacherIdForActor(actor);
    const existing = await this.findNonRevoked(teacherId);
    if (existing) {
      const renewed = await this.renewIfExpired(existing);
      return this.toEnsureResult(renewed, false);
    }

    try {
      return await this.insertNew(teacherId, actor.sub, label);
    } catch (err) {
      // Concurrent ensure under unique partial index — reuse the winner.
      if (this.isUniqueViolation(err)) {
        const raced = await this.findNonRevoked(teacherId);
        if (raced) {
          return this.toEnsureResult(await this.renewIfExpired(raced), false);
        }
      }
      throw err;
    }
  }

  /** @deprecated Prefer ensureMine — kept as alias so old clients stay idempotent. */
  async create(
    actor: JwtPayload,
    label?: string,
  ): Promise<{ id: string; token: string; expiresAt: Date; label: string | null }> {
    const ensured = await this.ensureMine(actor, label);
    return {
      id: ensured.id,
      token: ensured.token,
      expiresAt: ensured.expiresAt,
      label: ensured.label,
    };
  }

  async listMine(actor: JwtPayload): Promise<TeacherInviteListItem[]> {
    const teacherId = await this.resolveTeacherIdForActor(actor);
    const rows = await this.inviteRepo.find({
      where: { teacherId },
      order: { createdAt: 'DESC' },
    });
    const activeStudentsCount = await this.countActiveReferralStudents(teacherId);
    return rows.map((row) =>
      Object.assign(row, {
        activeStudentsCount,
        /**
         * API `useCount` for UI = live referral students (role=student only).
         * Historical registration total remains in DB column; exposed as registrationCount.
         */
        registrationCount: row.useCount,
        useCount: activeStudentsCount,
      }),
    );
  }

  /**
   * Current referral students for a teacher.
   * Keeps referral history (assignedTeacherId) but counts only User.role = 'student'.
   * Excludes tutors/teachers/admins and users without a linked account.
   */
  async countActiveReferralStudents(teacherId: string): Promise<number> {
    if (!teacherId) return 0;
    const raw = await this.studentRepo
      .createQueryBuilder('s')
      .innerJoin('users', 'u', 'u.id = s.user_id')
      .where('s.assigned_teacher_id = :teacherId', { teacherId })
      .andWhere('u.role = :role', { role: 'student' })
      .getCount();
    return Number(raw) || 0;
  }

  async revoke(actor: JwtPayload, id: string): Promise<TeacherInviteLinkEntity> {
    const teacherId = await this.resolveTeacherIdForActor(actor);
    const row = await this.inviteRepo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException('Ссылка приглашения не найдена');
    }
    if (normalizeRole(actor.role) !== 'admin' && row.teacherId !== teacherId) {
      throw new ForbiddenException('Нельзя отозвать чужую ссылку');
    }
    row.revokedAt = new Date();
    return this.inviteRepo.save(row);
  }

  /**
   * Resolve opaque invite token → teacher + link. Never accepts client teacherId.
   * Accepts:
   * - invite link UUID (stable public URL from ensureMine / list)
   * - legacy random token (SHA-256 hash lookup)
   */
  async resolveValidInvite(
    rawToken: string | undefined | null,
  ): Promise<{ teacherId: string; inviteLinkId: string } | null> {
    const token = String(rawToken ?? '').trim();
    if (!token) {
      return null;
    }

    let row: TeacherInviteLinkEntity | null = null;
    if (UUID_RE.test(token)) {
      row = await this.inviteRepo.findOne({ where: { id: token } });
    }
    if (!row) {
      row = await this.inviteRepo.findOne({ where: { tokenHash: this.hashToken(token) } });
    }
    if (!row) {
      throw new BadRequestException('Ссылка приглашения недействительна или устарела.');
    }
    if (row.revokedAt) {
      throw new BadRequestException('Ссылка приглашения отозвана.');
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Срок действия ссылки приглашения истёк.');
    }
    return { teacherId: row.teacherId, inviteLinkId: row.id };
  }

  async incrementUseCount(inviteLinkId: string | null | undefined): Promise<void> {
    if (!inviteLinkId) return;
    await this.inviteRepo.increment({ id: inviteLinkId }, 'useCount', 1);
  }

  private async findNonRevoked(teacherId: string): Promise<TeacherInviteLinkEntity | null> {
    return this.inviteRepo.findOne({
      where: { teacherId, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  private async renewIfExpired(row: TeacherInviteLinkEntity): Promise<TeacherInviteLinkEntity> {
    if (row.expiresAt.getTime() > Date.now()) {
      return row;
    }
    row.expiresAt = new Date(Date.now() + DEFAULT_TTL_MS);
    return this.inviteRepo.save(row);
  }

  private async insertNew(
    teacherId: string,
    createdByUserId: string,
    label?: string,
  ): Promise<TeacherInviteEnsureResult> {
    const rawToken = randomBytes(24).toString('base64url');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + DEFAULT_TTL_MS);
    const row = await this.inviteRepo.save(
      this.inviteRepo.create({
        teacherId,
        tokenHash,
        label: label?.trim() || null,
        expiresAt,
        revokedAt: null,
        createdByUserId,
        useCount: 0,
      }),
    );
    return this.toEnsureResult(row, true);
  }

  private toEnsureResult(
    row: TeacherInviteLinkEntity,
    created: boolean,
  ): TeacherInviteEnsureResult {
    return {
      id: row.id,
      token: row.id,
      expiresAt: row.expiresAt,
      label: row.label,
      created,
    };
  }

  private isUniqueViolation(err: unknown): boolean {
    if (err instanceof QueryFailedError) {
      const code = (err as QueryFailedError & { driverError?: { code?: string } }).driverError
        ?.code;
      if (code === '23505') return true;
    }
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === '23505'
    );
  }

  private async resolveTeacherIdForActor(actor: JwtPayload): Promise<string> {
    if (normalizeRole(actor.role) === 'admin') {
      const teacherId = await this.teacherAccess.resolveTeacherId(actor);
      if (!teacherId) {
        throw new BadRequestException(
          'Для создания ссылки нужен профиль преподавателя. Войдите как преподаватель.',
        );
      }
      return teacherId;
    }
    const teacherId = await this.teacherAccess.resolveTeacherId(actor);
    if (!teacherId) {
      throw new ForbiddenException('Профиль преподавателя не найден');
    }
    return teacherId;
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken.trim()).digest('hex');
  }
}
