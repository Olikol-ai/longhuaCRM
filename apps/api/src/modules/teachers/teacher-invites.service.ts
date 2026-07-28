import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { JwtPayload } from '../auth/auth.service';
import { TeacherAccessService } from '../../common/access/teacher-access.service';
import { normalizeRole } from '../../common/constants/roles';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherInviteLinkEntity } from './entities/teacher-invite-link.entity';

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type TeacherInviteListItem = TeacherInviteLinkEntity & {
  /** Live count: students still assigned to this teacher with User.role = student. */
  activeStudentsCount: number;
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

  async create(
    actor: JwtPayload,
    label?: string,
  ): Promise<{ id: string; token: string; expiresAt: Date; label: string | null }> {
    const teacherId = await this.resolveTeacherIdForActor(actor);
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
        createdByUserId: actor.sub,
        useCount: 0,
      }),
    );

    return {
      id: row.id,
      token: rawToken,
      expiresAt: row.expiresAt,
      label: row.label,
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
   */
  async resolveValidInvite(
    rawToken: string | undefined | null,
  ): Promise<{ teacherId: string; inviteLinkId: string } | null> {
    const token = String(rawToken ?? '').trim();
    if (!token) {
      return null;
    }
    const tokenHash = this.hashToken(token);
    const row = await this.inviteRepo.findOne({ where: { tokenHash } });
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
