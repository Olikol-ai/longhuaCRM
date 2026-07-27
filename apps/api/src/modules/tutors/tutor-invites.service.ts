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
import { TutorAccessService } from '../../common/access/tutor-access.service';
import { normalizeRole } from '../../common/constants/roles';
import { TutorInviteLinkEntity } from './entities/tutor-invite-link.entity';

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class TutorInvitesService {
  constructor(
    @InjectRepository(TutorInviteLinkEntity)
    private readonly inviteRepo: Repository<TutorInviteLinkEntity>,
    private readonly tutorAccess: TutorAccessService,
  ) {}

  async create(
    actor: JwtPayload,
    label?: string,
  ): Promise<{ id: string; token: string; expiresAt: Date; label: string | null }> {
    const tutorId = await this.resolveTutorIdForActor(actor);
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
