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
import { TutorAccessService } from '../../common/access/tutor-access.service';
import { normalizeRole } from '../../common/constants/roles';
import { TutorInviteLinkEntity } from './entities/tutor-invite-link.entity';

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TutorInviteEnsureResult = {
  id: string;
  token: string;
  expiresAt: Date;
  label: string | null;
  created: boolean;
};

@Injectable()
export class TutorInvitesService {
  constructor(
    @InjectRepository(TutorInviteLinkEntity)
    private readonly inviteRepo: Repository<TutorInviteLinkEntity>,
    private readonly tutorAccess: TutorAccessService,
  ) {}

  /**
   * Idempotent public link for a tutor: reuse the single non-revoked row,
   * create only when none exists.
   */
  async ensureMine(
    actor: JwtPayload,
    label?: string,
  ): Promise<TutorInviteEnsureResult> {
    const tutorId = await this.resolveTutorIdForActor(actor);
    const existing = await this.findNonRevoked(tutorId);
    if (existing) {
      const renewed = await this.renewIfExpired(existing);
      return this.toEnsureResult(renewed, false);
    }

    try {
      return await this.insertNew(tutorId, actor.sub, label);
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        const raced = await this.findNonRevoked(tutorId);
        if (raced) {
          return this.toEnsureResult(await this.renewIfExpired(raced), false);
        }
      }
      throw err;
    }
  }

  /** @deprecated Prefer ensureMine — alias kept idempotent for old clients. */
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

  async listMine(actor: JwtPayload): Promise<TutorInviteLinkEntity[]> {
    const tutorId = await this.resolveTutorIdForActor(actor);
    return this.inviteRepo.find({
      where: { tutorId },
      order: { createdAt: 'DESC' },
    });
  }

  async revoke(actor: JwtPayload, id: string): Promise<TutorInviteLinkEntity> {
    const tutorId = await this.resolveTutorIdForActor(actor);
    const row = await this.inviteRepo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException('Ссылка приглашения не найдена');
    }
    if (normalizeRole(actor.role) !== 'admin' && row.tutorId !== tutorId) {
      throw new ForbiddenException('Нельзя отозвать чужую ссылку');
    }
    row.revokedAt = new Date();
    return this.inviteRepo.save(row);
  }

  /**
   * Lookup by token without throwing when missing (so auth can try teacher invites next).
   */
  async findByRawToken(rawToken: string | undefined | null): Promise<TutorInviteLinkEntity | null> {
    const token = String(rawToken ?? '').trim();
    if (!token) {
      return null;
    }
    if (UUID_RE.test(token)) {
      const byId = await this.inviteRepo.findOne({ where: { id: token } });
      if (byId) return byId;
    }
    return this.inviteRepo.findOne({ where: { tokenHash: this.hashToken(token) } });
  }

  /**
   * Resolve opaque invite token → tutor + link. Never accepts client tutorId.
   */
  async resolveValidInvite(
    rawToken: string | undefined | null,
  ): Promise<{ tutorId: string; inviteLinkId: string } | null> {
    const token = String(rawToken ?? '').trim();
    if (!token) {
      return null;
    }
    const row = await this.findByRawToken(token);
    if (!row) {
      return null;
    }
    if (row.revokedAt) {
      throw new BadRequestException('Ссылка приглашения отозвана.');
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Срок действия ссылки приглашения истёк.');
    }
    return { tutorId: row.tutorId, inviteLinkId: row.id };
  }

  async incrementUseCount(inviteLinkId: string | null | undefined): Promise<void> {
    if (!inviteLinkId) return;
    await this.inviteRepo.increment({ id: inviteLinkId }, 'useCount', 1);
  }

  private async findNonRevoked(tutorId: string): Promise<TutorInviteLinkEntity | null> {
    return this.inviteRepo.findOne({
      where: { tutorId, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  private async renewIfExpired(row: TutorInviteLinkEntity): Promise<TutorInviteLinkEntity> {
    if (row.expiresAt.getTime() > Date.now()) {
      return row;
    }
    row.expiresAt = new Date(Date.now() + DEFAULT_TTL_MS);
    return this.inviteRepo.save(row);
  }

  private async insertNew(
    tutorId: string,
    createdByUserId: string,
    label?: string,
  ): Promise<TutorInviteEnsureResult> {
    const rawToken = randomBytes(24).toString('base64url');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + DEFAULT_TTL_MS);
    const row = await this.inviteRepo.save(
      this.inviteRepo.create({
        tutorId,
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
    row: TutorInviteLinkEntity,
    created: boolean,
  ): TutorInviteEnsureResult {
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

  private async resolveTutorIdForActor(actor: JwtPayload): Promise<string> {
    if (normalizeRole(actor.role) === 'admin') {
      const tutorId = await this.tutorAccess.resolveTutorId(actor);
      if (!tutorId) {
        throw new BadRequestException(
          'Для создания ссылки нужен профиль репетитора. Войдите как репетитор.',
        );
      }
      return tutorId;
    }
    const tutorId = await this.tutorAccess.resolveTutorId(actor);
    if (!tutorId) {
      throw new ForbiddenException('Профиль репетитора не найден');
    }
    return tutorId;
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken.trim()).digest('hex');
  }
}
