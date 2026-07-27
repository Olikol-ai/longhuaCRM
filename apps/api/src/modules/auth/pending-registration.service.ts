import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomInt, randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { validateRegistrationPassword } from '../../common/security/password-validation';
import { RateLimitService } from '../../common/security/rate-limit.service';
import { PendingRegistrationEntity } from './entities/pending-registration.entity';
import { UserEntity } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';
import { UsersRepository } from '../users/users.repository';
import { RoleEntitySyncService } from '../users/role-entity-sync.service';
import { TeacherInviteLinkEntity } from '../teachers/entities/teacher-invite-link.entity';
import { TutorInviteLinkEntity } from '../tutors/entities/tutor-invite-link.entity';
import { RegisterDto } from './dto/register.dto';
import { PendingRegistrationRepository } from './pending-registration.repository';

export const REGISTRATION_EMAIL_FAILED_MESSAGE =
  'Не удалось отправить код подтверждения. Проверьте email или попробуйте позже.';

export const VERIFICATION_CODE_TTL_MS = 15 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_VERIFY_ATTEMPTS = 5;
const MAX_SENDS_PER_HOUR = 5;
const MAX_SENDS_PER_DAY = 20;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type PendingRegistrationSendResult = {
  success: boolean;
  email_sent: boolean;
  email_status: 'sent' | 'email_not_sent';
  message?: string;
};

export type RegistrationInvite =
  | { kind: 'teacher'; teacherId: string; inviteLinkId: string }
  | { kind: 'tutor'; tutorId: string; inviteLinkId: string };

@Injectable()
export class PendingRegistrationService {
  private readonly logger = new Logger(PendingRegistrationService.name);

  constructor(
    private readonly pendingRepository: PendingRegistrationRepository,
    private readonly usersRepository: UsersRepository,
    private readonly mail: MailService,
    private readonly rateLimit: RateLimitService,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly roleEntitySync: RoleEntitySyncService,
  ) {}

  generateCode(): string {
    return String(randomInt(100000, 999999));
  }

  hashCode(code: string): string {
    return bcrypt.hashSync(code.trim(), 10);
  }

  async startRegistration(
    dto: RegisterDto,
    normalizedEmail: string,
    phone: string,
    invite?: RegistrationInvite | null,
  ): Promise<{ pending: PendingRegistrationEntity; emailDelivery: PendingRegistrationSendResult }> {
    const passwordHash = bcrypt.hashSync(dto.password, 10);
    const now = new Date();
    const wantsStudentRole =
      dto.wantsStudentRole === true ||
      invite?.kind === 'teacher' ||
      invite?.kind === 'tutor';
    let pending = await this.pendingRepository.findByEmail(normalizedEmail);

    if (pending?.status === 'blocked') {
      pending.status = 'pending';
      pending.verificationAttempts = 0;
    }

    const inviteTeacherId = invite?.kind === 'teacher' ? invite.teacherId : null;
    const inviteLinkId = invite?.kind === 'teacher' ? invite.inviteLinkId : null;
    const inviteTutorId = invite?.kind === 'tutor' ? invite.tutorId : null;
    const inviteTutorLinkId = invite?.kind === 'tutor' ? invite.inviteLinkId : null;

    if (pending) {
      pending.passwordHash = passwordHash;
      pending.firstName = dto.first_name ?? '';
      pending.lastName = dto.last_name ?? '';
      pending.phone = phone;
      pending.wantsStudentRole = wantsStudentRole;
      pending.inviteTeacherId = inviteTeacherId;
      pending.inviteLinkId = inviteLinkId;
      pending.inviteTutorId = inviteTutorId;
      pending.inviteTutorLinkId = inviteTutorLinkId;
      pending.status = 'pending';
      pending.verificationAttempts = 0;
      pending.expiresAt = new Date(now.getTime() + this.getRegistrationTtlMs());
      pending.updatedDate = now;
    } else {
      pending = {
        id: randomUUID(),
        email: normalizedEmail,
        passwordHash,
        firstName: dto.first_name ?? '',
        lastName: dto.last_name ?? '',
        phone,
        wantsStudentRole,
        inviteTeacherId,
        inviteLinkId,
        inviteTutorId,
        inviteTutorLinkId,
        verificationCodeHash: null,
        codeExpiresAt: null,
        lastSentAt: null,
        sendCount: 0,
        verificationAttempts: 0,
        status: 'pending',
        expiresAt: new Date(now.getTime() + this.getRegistrationTtlMs()),
        createdDate: now,
        updatedDate: now,
      } as PendingRegistrationEntity;
    }

    const emailDelivery = await this.issueAndSend(pending, { isResend: false });
    return { pending, emailDelivery };
  }

  async resendCode(normalizedEmail: string): Promise<PendingRegistrationSendResult> {
    const pending = await this.pendingRepository.findByEmail(normalizedEmail);
    if (!pending || pending.status !== 'pending') {
      throw new NotFoundException({
        success: false,
        message: 'Регистрация не найдена. Начните регистрацию заново.',
      });
    }

    if (pending.expiresAt.getTime() < Date.now()) {
      await this.pendingRepository.delete(pending.id);
      throw new BadRequestException({
        success: false,
        message: 'Срок регистрации истёк. Начните регистрацию заново.',
      });
    }

    return this.issueAndSend(pending, { isResend: true });
  }

  async verifyAndCreateUser(
    normalizedEmail: string,
    rawCode: string,
  ): Promise<UserEntity> {
    const code = rawCode.trim();

    return this.dataSource.transaction(async (manager) => {
      const pendingRepo = manager.getRepository(PendingRegistrationEntity);
      const usersRepo = manager.getRepository(UserEntity);

      const pending = await pendingRepo.findOne({
        where: { email: normalizedEmail },
        lock: { mode: 'pessimistic_write' },
      });

      // Idempotent completion: concurrent/double verify after success.
      if (!pending || pending.status !== 'pending') {
        const existing = await usersRepo.findOne({
          where: { email: normalizedEmail },
          lock: { mode: 'pessimistic_write' },
        });
        if (existing?.emailVerified) {
          if (existing.role === 'student') {
            await this.roleEntitySync.syncAfterRoleChange(existing, 'student', manager);
          }
          this.logger.log(
            `Registration verify idempotent hit for ${normalizedEmail} (user=${existing.id})`,
          );
          return existing;
        }
        throw new NotFoundException({
          success: false,
          message: 'Регистрация не найдена. Начните регистрацию заново.',
        });
      }

      if (pending.expiresAt.getTime() < Date.now()) {
        await pendingRepo.delete({ id: pending.id });
        throw new BadRequestException({
          success: false,
          message: 'Срок регистрации истёк. Начните регистрацию заново.',
        });
      }

      if (!pending.verificationCodeHash) {
        throw new BadRequestException({
          success: false,
          message: 'Код не найден. Запросите новый код.',
        });
      }

      if (pending.codeExpiresAt && pending.codeExpiresAt.getTime() < Date.now()) {
        throw new BadRequestException({
          success: false,
          message: 'Код истёк',
        });
      }

      if (pending.verificationAttempts >= MAX_VERIFY_ATTEMPTS) {
        pending.status = 'blocked';
        pending.updatedDate = new Date();
        await pendingRepo.save(pending);
        throw new BadRequestException({
          success: false,
          message: 'Слишком много попыток. Запросите новый код.',
        });
      }

      const isValid = bcrypt.compareSync(code, pending.verificationCodeHash);
      if (!isValid) {
        pending.verificationAttempts += 1;
        pending.updatedDate = new Date();
        await pendingRepo.save(pending);

        const remaining = MAX_VERIFY_ATTEMPTS - pending.verificationAttempts;
        if (pending.verificationAttempts >= MAX_VERIFY_ATTEMPTS) {
          pending.status = 'blocked';
          await pendingRepo.save(pending);
        }

        throw new BadRequestException({
          success: false,
          message:
            remaining > 0
              ? `Неверный код. Осталось попыток: ${remaining}.`
              : 'Неверный код. Запросите новый код.',
        });
      }

      // Server-side only: never accept role from client.
      const inviteTeacherId = pending.inviteTeacherId;
      const inviteLinkId = pending.inviteLinkId;
      const inviteTutorId = pending.inviteTutorId;
      const inviteTutorLinkId = pending.inviteTutorLinkId;

      let assignedRole = '';
      if (inviteTutorId) {
        assignedRole = 'tutor_student';
      } else if (pending.wantsStudentRole === true || Boolean(inviteTeacherId)) {
        assignedRole = 'student';
      }

      let user = await usersRepo.findOne({
        where: { email: normalizedEmail },
        lock: { mode: 'pessimistic_write' },
      });

      if (user) {
        // Race / retry while pending still exists: finish identity flags + role sync, then drop pending.
        let dirty = false;
        if (!user.emailVerified) {
          user.emailVerified = true;
          dirty = true;
        }
        if (user.status !== 'active') {
          user.status = 'active';
          dirty = true;
        }
        if (assignedRole && user.role !== assignedRole) {
          user.role = assignedRole;
          dirty = true;
        }
        if (dirty) {
          user.updatedDate = new Date();
          user = await usersRepo.save(user);
        }
        if (user.role === 'student') {
          await this.roleEntitySync.syncAfterRoleChange(user, 'student', manager, {
            assignedTeacherId: inviteTeacherId,
          });
        }
        if (user.role === 'tutor_student') {
          await this.roleEntitySync.syncAfterRoleChange(user, 'tutor_student', manager, {
            assignedTutorId: inviteTutorId,
          });
        }
        if (inviteLinkId) {
          await manager.getRepository(TeacherInviteLinkEntity).increment({ id: inviteLinkId }, 'useCount', 1);
        }
        if (inviteTutorLinkId) {
          await manager.getRepository(TutorInviteLinkEntity).increment({ id: inviteTutorLinkId }, 'useCount', 1);
        }
        await pendingRepo.delete({ id: pending.id });
        this.logger.log(
          `Registration verify raced existing user for ${normalizedEmail} (role=${user.role || 'none'})`,
        );
        return user;
      }

      const now = new Date();
      const created = await usersRepo.save(
        usersRepo.create({
          id: randomUUID(),
          email: normalizedEmail,
          passwordHash: pending.passwordHash,
          role: assignedRole,
          status: 'active',
          emailVerified: true,
          verificationCode: null,
          verificationCodeExpiresAt: null,
          verificationCodeSentAt: null,
          verificationAttempts: 0,
          firstName: pending.firstName,
          lastName: pending.lastName,
          phone: pending.phone,
          telegramId: '',
          telegramUsername: '',
          telegramConnectedAt: null,
          telegramLinkToken: null,
          telegramLinkExpires: null,
          passwordResetToken: null,
          passwordResetExpiresAt: null,
          telegramNotify24h: true,
          telegramNotify3h: true,
          createdDate: now,
          updatedDate: now,
        }),
      );

      // Profile sync BEFORE deleting pending — all-or-nothing with user insert.
      if (assignedRole === 'student') {
        await this.roleEntitySync.syncAfterRoleChange(created, 'student', manager, {
          assignedTeacherId: inviteTeacherId,
        });
      }
      if (assignedRole === 'tutor_student') {
        await this.roleEntitySync.syncAfterRoleChange(created, 'tutor_student', manager, {
          assignedTutorId: inviteTutorId,
        });
      }

      if (inviteLinkId) {
        await manager.getRepository(TeacherInviteLinkEntity).increment({ id: inviteLinkId }, 'useCount', 1);
      }
      if (inviteTutorLinkId) {
        await manager.getRepository(TutorInviteLinkEntity).increment({ id: inviteTutorLinkId }, 'useCount', 1);
      }

      await pendingRepo.delete({ id: pending.id });

      this.logger.log(
        `Registration completed for ${normalizedEmail} (role=${assignedRole || 'none'})`,
      );
      return created;
    });
  }

  assertPasswordStrength(password: string): void {
    try {
      validateRegistrationPassword(password);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }

  private getRegistrationTtlMs(): number {
    const ttlHours = this.config.get<number>('pendingRegistration.ttlHours') ?? 24;
    return ttlHours * 60 * 60 * 1000;
  }

  private async issueAndSend(
    pending: PendingRegistrationEntity,
    options: { isResend: boolean },
  ): Promise<PendingRegistrationSendResult> {
    this.assertCanSend(pending.email, pending.lastSentAt, options.isResend);

    const plainCode = this.generateCode();
    const emailDelivery = await this.mail.sendVerificationCode(pending.email, plainCode);

    if (!emailDelivery.sent) {
      const safeError = this.sanitizeMailError(emailDelivery.error ?? 'unknown error');
      this.logger.error(
        `registration email failed\nrecipient: ${pending.email}\nerror: ${safeError}`,
      );

      if (!options.isResend) {
        const existing = await this.pendingRepository.findByEmail(pending.email);
        if (existing) {
          await this.pendingRepository.delete(existing.id);
        }
      }

      throw new InternalServerErrorException({
        success: false,
        message: REGISTRATION_EMAIL_FAILED_MESSAGE,
      });
    }

    const now = new Date();
    pending.verificationCodeHash = this.hashCode(plainCode);
    pending.codeExpiresAt = new Date(now.getTime() + VERIFICATION_CODE_TTL_MS);
    pending.lastSentAt = now;
    pending.sendCount += 1;
    pending.verificationAttempts = 0;
    pending.status = 'pending';
    pending.updatedDate = now;

    await this.pendingRepository.save(pending);

    return {
      success: true,
      email_sent: true,
      email_status: 'sent',
    };
  }

  private sanitizeMailError(error: string): string {
    return error
      .replace(/password[=:\s][^\s,;]+/gi, 'password=***')
      .replace(/MAIL_PASS[=:\s][^\s,;]+/gi, 'MAIL_PASS=***')
      .replace(/auth:\s*\{[^}]*pass:\s*'[^']*'/gi, "auth: { pass: '***'");
  }

  private assertCanSend(email: string, sentAt: Date | null, isResend: boolean): void {
    if (isResend) {
      this.assertResendCooldown(sentAt, email);
    }

    try {
      this.rateLimit.assertAllowed(
        `verify-send:email:${email}:hour`,
        MAX_SENDS_PER_HOUR,
        HOUR_MS,
        'Лимит отправки кодов превышен',
      );
    } catch (error) {
      this.logger.warn(`Verification resend blocked for ${email} (hourly limit)`);
      throw error;
    }

    try {
      this.rateLimit.assertAllowed(
        `verify-send:email:${email}:day`,
        MAX_SENDS_PER_DAY,
        DAY_MS,
        'Лимит отправки кодов превышен',
      );
    } catch (error) {
      this.logger.warn(`Verification resend blocked for ${email} (daily limit)`);
      throw error;
    }
  }

  private assertResendCooldown(sentAt: Date | null, email: string): void {
    if (!sentAt) {
      return;
    }

    const elapsed = Date.now() - sentAt.getTime();
    if (elapsed >= RESEND_COOLDOWN_MS) {
      return;
    }

    const retryAfter = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
    this.logger.warn(`Verification resend blocked for ${email} (cooldown ${retryAfter}s)`);

    throw new HttpException(
      {
        success: false,
        message: `Повторная отправка доступна через ${retryAfter} секунд`,
        retryAfter,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
