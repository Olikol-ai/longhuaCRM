import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { RateLimitService } from '../../common/security/rate-limit.service';
import { UserEntity } from '../../entities/user.entity';
import { MailService } from '../mail/mail.service';
import { UsersRepository } from '../users/users.repository';

export const VERIFICATION_CODE_TTL_MS = 15 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_VERIFY_ATTEMPTS = 5;
const MAX_SENDS_PER_HOUR = 5;
const MAX_SENDS_PER_DAY = 20;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type VerificationSendResult = {
  success: boolean;
  email_sent: boolean;
  email_status: 'sent' | 'email_not_sent';
  message?: string;
};

@Injectable()
export class VerificationEmailService {
  private readonly logger = new Logger(VerificationEmailService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly mail: MailService,
    private readonly rateLimit: RateLimitService,
  ) {}

  generateCode(): string {
    return String(randomInt(100000, 999999));
  }

  hashCode(code: string): string {
    return bcrypt.hashSync(code.trim(), 10);
  }

  assertCanSend(email: string, sentAt: Date | null, isResend: boolean): void {
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

  async issueAndSend(
    user: UserEntity,
    options: { isResend: boolean },
  ): Promise<VerificationSendResult> {
    this.assertCanSend(user.email, user.verificationCodeSentAt, options.isResend);

    const plainCode = this.generateCode();
    const now = new Date();

    user.verificationCode = this.hashCode(plainCode);
    user.verificationCodeExpiresAt = new Date(now.getTime() + VERIFICATION_CODE_TTL_MS);
    user.verificationCodeSentAt = now;
    user.verificationAttempts = 0;
    user.updatedDate = now;

    await this.usersRepository.save(user);

    const emailDelivery = await this.mail.sendVerificationCode(user.email, plainCode);

    return {
      success: emailDelivery.sent,
      email_sent: emailDelivery.sent,
      email_status: emailDelivery.status,
      message: emailDelivery.sent
        ? undefined
        : 'Не удалось отправить письмо с кодом',
    };
  }

  async verifyCode(user: UserEntity, rawCode: string): Promise<void> {
    const code = rawCode.trim();

    if (!user.verificationCode) {
      throw new BadRequestException({
        success: false,
        message: 'Код не найден. Запросите новый код.',
      });
    }

    if (
      user.verificationCodeExpiresAt &&
      user.verificationCodeExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException({
        success: false,
        message: 'Код истек',
      });
    }

    if ((user.verificationAttempts ?? 0) >= MAX_VERIFY_ATTEMPTS) {
      throw new BadRequestException({
        success: false,
        message: 'Слишком много попыток. Запросите новый код.',
      });
    }

    const isValid = bcrypt.compareSync(code, user.verificationCode);
    if (!isValid) {
      user.verificationAttempts = (user.verificationAttempts ?? 0) + 1;
      user.updatedDate = new Date();
      await this.usersRepository.save(user);

      const remaining = MAX_VERIFY_ATTEMPTS - user.verificationAttempts;
      throw new BadRequestException({
        success: false,
        message:
          remaining > 0
            ? `Неверный код. Осталось попыток: ${remaining}.`
            : 'Неверный код. Запросите новый код.',
      });
    }

    user.status = 'active';
    user.emailVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpiresAt = null;
    user.verificationCodeSentAt = null;
    user.verificationAttempts = 0;
    user.updatedDate = new Date();
    await this.usersRepository.save(user);

    this.logger.log(`Email verified for ${user.email}`);
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
