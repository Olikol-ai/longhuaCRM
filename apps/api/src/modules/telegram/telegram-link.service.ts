import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { UsersRepository } from '../users/users.repository';

const LINK_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class TelegramLinkService {
  private readonly logger = new Logger(TelegramLinkService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
  ) {}

  async createLink(userId: string): Promise<{ link: string; expiresAt: string }> {
    const row = await this.usersRepository.findById(userId);
    if (!row) {
      throw new UnauthorizedException('User not found');
    }

    if (row.status !== 'active') {
      throw new ForbiddenException('Telegram linking requires an active account');
    }

    const token = randomBytes(16).toString('hex');
    const expires = new Date(Date.now() + LINK_TTL_MS);
    row.telegramLinkToken = token;
    row.telegramLinkExpires = expires;
    row.updatedDate = new Date();
    await this.usersRepository.save(row);

    const botUsername = this.getBotUsername();
    return {
      link: `https://t.me/${botUsername}?start=${token}`,
      expiresAt: expires.toISOString(),
    };
  }

  async getStatus(userId: string): Promise<{
    connected: boolean;
    username: string | null;
    connectedAt: string | null;
  }> {
    const row = await this.usersRepository.findById(userId);
    if (!row) {
      throw new UnauthorizedException('User not found');
    }
    const connected = Boolean(row.telegramId?.trim());
    return {
      connected,
      username: connected ? (row.telegramUsername?.trim() || null) : null,
      connectedAt: row.telegramConnectedAt
        ? row.telegramConnectedAt.toISOString()
        : null,
    };
  }

  /**
   * Consume one-time deep-link token from /start {token}.
   */
  async completeLinkByToken(
    rawToken: string,
    telegramId: string,
    telegramUsername?: string,
  ): Promise<boolean> {
    const token = rawToken.replace(/^link_/, '').trim();
    if (!token) {
      return false;
    }

    const row = await this.usersRepository.findByLinkToken(token);
    if (!row) {
      return false;
    }
    if (row.status !== 'active') {
      return false;
    }
    if (row.telegramLinkExpires && row.telegramLinkExpires < new Date()) {
      return false;
    }

    const existing = await this.usersRepository.findByTelegramId(telegramId);
    if (existing && existing.id !== row.id) {
      this.logger.warn(
        `Telegram chat ${telegramId} already linked to user ${existing.id}`,
      );
      return false;
    }

    const now = new Date();
    row.telegramId = telegramId;
    row.telegramUsername = telegramUsername ?? '';
    row.telegramConnectedAt = now;
    row.telegramLinkToken = null;
    row.telegramLinkExpires = null;
    row.updatedDate = now;
    await this.usersRepository.save(row);

    this.logger.log(
      `Telegram deep-link: chatId=${telegramId} userId=${row.id} role=${row.role}`,
    );

    const student = await this.studentRepo.findOne({ where: { userId: row.id } });
    if (student) {
      student.telegramId = telegramId;
      student.telegramUsername = telegramUsername ?? student.telegramUsername;
      student.telegramConnectedAt = now;
      await this.studentRepo.save(student);
    }

    const teacher = await this.teacherRepo.findOne({ where: { userId: row.id } });
    if (teacher) {
      teacher.telegramId = telegramId;
      await this.teacherRepo.save(teacher);
    }

    await this.audit.log({
      actorUserId: row.id,
      action: 'telegram_link',
      entityType: 'User',
      entityId: row.id,
      summary: `Telegram linked: @${telegramUsername ?? telegramId}`,
    });

    return true;
  }

  async unlink(userId: string): Promise<{ ok: true }> {
    const row = await this.usersRepository.findById(userId);
    if (!row) {
      throw new UnauthorizedException('User not found');
    }
    if (!row.telegramId?.trim()) {
      throw new BadRequestException('Telegram не привязан');
    }

    row.telegramId = '';
    row.telegramUsername = '';
    row.telegramConnectedAt = null;
    row.telegramLinkToken = null;
    row.telegramLinkExpires = null;
    row.updatedDate = new Date();
    await this.usersRepository.save(row);

    const student = await this.studentRepo.findOne({ where: { userId: row.id } });
    if (student) {
      student.telegramId = null;
      student.telegramUsername = null;
      student.telegramConnectedAt = null;
      await this.studentRepo.save(student);
    }

    const teacher = await this.teacherRepo.findOne({ where: { userId: row.id } });
    if (teacher) {
      teacher.telegramId = null;
      await this.teacherRepo.save(teacher);
    }

    await this.audit.log({
      actorUserId: row.id,
      action: 'telegram_unlink',
      entityType: 'User',
      entityId: row.id,
      summary: 'Telegram unlinked',
    });

    return { ok: true };
  }

  getBotUsername(): string {
    return (
      this.config.get<string>('telegram.botUsername')?.trim()
      || process.env.TELEGRAM_BOT_USERNAME?.trim()
      || 'LonghuaChinese_bot'
    );
  }

  async isChatLinked(telegramId: string): Promise<boolean> {
    const row = await this.usersRepository.findByTelegramId(String(telegramId).trim());
    return Boolean(row?.telegramId?.trim());
  }

  /**
   * Resolve Telegram chat for student/teacher profiles.
   * Source of truth: linked User.telegram_id (profile fields are synced copies).
   */
  async resolveTelegramForProfile(
    targetType: 'student' | 'teacher',
    targetId: string,
  ): Promise<{
    linked: boolean;
    telegramId: string | null;
    username: string | null;
  }> {
    if (targetType === 'student') {
      const student = await this.studentRepo.findOne({ where: { id: targetId } });
      if (!student) {
        return { linked: false, telegramId: null, username: null };
      }

      if (student.userId) {
        const user = await this.usersRepository.findById(student.userId);
        if (user) {
          const userTg = (user.telegramId ?? '').trim();
          const nextId = userTg || null;
          const nextUsername = userTg ? (user.telegramUsername?.trim() || null) : null;
          const nextConnectedAt = userTg ? (user.telegramConnectedAt ?? null) : null;
          if (
            (student.telegramId ?? null) !== nextId
            || (student.telegramUsername ?? null) !== nextUsername
          ) {
            student.telegramId = nextId;
            student.telegramUsername = nextUsername;
            student.telegramConnectedAt = nextConnectedAt;
            await this.studentRepo.save(student);
          }
          return {
            linked: Boolean(userTg),
            telegramId: userTg || null,
            username: nextUsername,
          };
        }
      }

      const telegramId = (student.telegramId ?? '').trim();
      return {
        linked: Boolean(telegramId),
        telegramId: telegramId || null,
        username: (student.telegramUsername ?? '').trim() || null,
      };
    }

    const teacher = await this.teacherRepo.findOne({ where: { id: targetId } });
    if (!teacher) {
      return { linked: false, telegramId: null, username: null };
    }

    if (teacher.userId) {
      const user = await this.usersRepository.findById(teacher.userId);
      if (user) {
        const userTg = (user.telegramId ?? '').trim();
        const nextId = userTg || null;
        if ((teacher.telegramId ?? null) !== nextId) {
          teacher.telegramId = nextId;
          await this.teacherRepo.save(teacher);
        }
        return {
          linked: Boolean(userTg),
          telegramId: userTg || null,
          username: userTg ? (user.telegramUsername?.trim() || null) : null,
        };
      }
    }

    const telegramId = (teacher.telegramId ?? '').trim();
    return {
      linked: Boolean(telegramId),
      telegramId: telegramId || null,
      username: null,
    };
  }

  async resolveStudentTelegramChatId(studentId: string): Promise<string | null> {
    const resolved = await this.resolveTelegramForProfile('student', studentId);
    return resolved.telegramId;
  }
}
