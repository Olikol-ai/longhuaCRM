import {

  BadRequestException,

  ConflictException,

  ForbiddenException,

  Injectable,

  UnauthorizedException,

} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { JwtService } from '@nestjs/jwt';

import * as bcrypt from 'bcryptjs';

import { randomBytes, randomUUID } from 'crypto';

import { validateRegistrationEmail } from '../../common/security/email-validation';

import { RateLimitService } from '../../common/security/rate-limit.service';

import { AuditService } from '../audit/audit.service';

import { UsersRepository } from '../users/users.repository';

import { UserProfileService } from '../users/user-profile.service';

import { userToRecord } from '../users/user.mapper';

import { LoginDto } from './dto/login.dto';

import { RegisterDto } from './dto/register.dto';

import { UpdateMeDto } from './dto/update-me.dto';

import {

  getOnboardingContext,

  hasDashboardAccess,

  validateBelarusPhone,

} from './onboarding';

import { PendingRegistrationRepository } from './pending-registration.repository';

import { PendingRegistrationService } from './pending-registration.service';

import { VerificationEmailService } from './verification-email.service';



export interface JwtPayload {

  sub: string;

  email: string;

  role: string;

}



const MAX_LOGIN_ATTEMPTS = 5;

const LOGIN_WINDOW_MS = 15 * 60 * 1000;

const REGISTER_WINDOW_MS = 60 * 60 * 1000;

const VERIFY_RATE_WINDOW_MS = 15 * 60 * 1000;

const MAX_VERIFY_REQUESTS_PER_USER = 20;

const MAX_VERIFY_REQUESTS_PER_IP = 40;



function generateLinkToken(): string {

  return randomBytes(16).toString('hex');

}



function authResponse(row: Awaited<ReturnType<UsersRepository['findById']>>, signToken: (u: Record<string, unknown>) => string) {

  if (!row) throw new UnauthorizedException('User not found');

  const user = userToRecord(row);

  const onboarding = getOnboardingContext(row);

  return {

    token: signToken(user),

    user,

    onboarding_state: onboarding.onboarding_state,

    redirect_path: onboarding.redirect_path,

  };

}



@Injectable()

export class AuthService {

  constructor(

    private readonly usersRepository: UsersRepository,

    private readonly userProfileService: UserProfileService,

    private readonly jwtService: JwtService,

    private readonly config: ConfigService,

    private readonly rateLimit: RateLimitService,

    private readonly audit: AuditService,

    private readonly verificationEmail: VerificationEmailService,

    private readonly pendingRegistration: PendingRegistrationService,

    private readonly pendingRepository: PendingRegistrationRepository,

  ) {}



  async login(dto: LoginDto, clientIp: string) {

    const normalizedEmail = dto.email.trim().toLowerCase();

    this.rateLimit.assertAllowed(`login-ip:${clientIp}`, MAX_LOGIN_ATTEMPTS, LOGIN_WINDOW_MS);

    this.rateLimit.assertAllowed(`login:${normalizedEmail}`, MAX_LOGIN_ATTEMPTS, LOGIN_WINDOW_MS);



    const row = await this.usersRepository.findByEmail(normalizedEmail);

    if (!row || !bcrypt.compareSync(dto.password, row.passwordHash)) {

      const pending = await this.pendingRepository.findByEmail(normalizedEmail);

      if (pending && pending.status === 'pending') {

        throw new UnauthorizedException(

          'Аккаунт ещё не создан. Подтвердите email, чтобы завершить регистрацию.',

        );

      }

      throw new UnauthorizedException('Invalid email or password');

    }



    const onboarding = getOnboardingContext(row);



    if (onboarding.status === 'blocked') {

      throw new ForbiddenException('Account is blocked. Contact administrator.');

    }



    if (onboarding.status === 'pending' || onboarding.onboarding_state === 'needs_verification') {

      throw new ForbiddenException('Please verify your registration code first.');

    }



    this.rateLimit.reset(`login-ip:${clientIp}`);

    this.rateLimit.reset(`login:${normalizedEmail}`);



    return this.attachProfileFields(authResponse(row, (u) => this.signToken(u)), row.id);

  }



  async register(dto: RegisterDto, clientIp: string) {

    this.rateLimit.assertAllowed(`register-ip:${clientIp}`, 5, REGISTER_WINDOW_MS);



    let normalizedEmail: string;

    try {

      normalizedEmail = validateRegistrationEmail(dto.email);

    } catch (error) {

      throw new BadRequestException((error as Error).message);

    }



    this.pendingRegistration.assertPasswordStrength(dto.password);

    this.rateLimit.assertAllowed(`register:${normalizedEmail}`, 3, REGISTER_WINDOW_MS);



    const existing = await this.usersRepository.findByEmail(normalizedEmail);

    if (existing) {

      if (existing.status === 'active' || existing.emailVerified) {

        throw new ConflictException('Email already registered');

      }

      throw new ConflictException(

        'Email already registered. Complete verification or contact administrator.',

      );

    }



    let phone = '';

    if (dto.phone?.trim()) {

      try {

        validateBelarusPhone(dto.phone);

      } catch {

        throw new BadRequestException('Phone must match format +375 (29) 999-99-99');

      }

      phone = dto.phone.trim();

      const phoneOwner = await this.usersRepository.findByPhone(phone);

      if (phoneOwner) {

        throw new ConflictException('Phone number already registered');

      }

      const pendingPhoneOwner = await this.pendingRepository.findByPhone(phone);

      if (pendingPhoneOwner && pendingPhoneOwner.email !== normalizedEmail) {

        throw new ConflictException('Phone number already registered');

      }

    }



    const { emailDelivery } = await this.pendingRegistration.startRegistration(

      dto,

      normalizedEmail,

      phone,

    );



    return {

      success: emailDelivery.success,

      pending: true,

      email: normalizedEmail,

      email_sent: emailDelivery.email_sent,

      email_status: emailDelivery.email_status,

      message: emailDelivery.message,

    };

  }



  async verifyRegistration(email: string, code: string, clientIp: string) {

    const normalizedEmail = email.trim().toLowerCase();



    this.rateLimit.assertAllowed(

      `verify-code:email:${normalizedEmail}`,

      MAX_VERIFY_REQUESTS_PER_USER,

      VERIFY_RATE_WINDOW_MS,

      'Слишком много попыток проверки кода',

    );

    this.rateLimit.assertAllowed(

      `verify-code:ip:${clientIp}`,

      MAX_VERIFY_REQUESTS_PER_IP,

      VERIFY_RATE_WINDOW_MS,

      'Слишком много попыток проверки кода',

    );



    const row = await this.pendingRegistration.verifyAndCreateUser(normalizedEmail, code);



    await this.audit.log({

      actorUserId: row.id,

      action: 'verify_registration',

      entityType: 'User',

      entityId: row.id,

      summary: 'Registration email verified, user created',

    });



    const saved = await this.usersRepository.findById(row.id);

    const response = authResponse(saved, (u) => this.signToken(u));

    return this.attachProfileFields(response, row.id);

  }



  async resendRegistrationCode(email: string) {

    const normalizedEmail = email.trim().toLowerCase();

    const emailDelivery = await this.pendingRegistration.resendCode(normalizedEmail);



    return {

      success: emailDelivery.success,

      ok: emailDelivery.success,

      email_sent: emailDelivery.email_sent,

      email_status: emailDelivery.email_status,

      message: emailDelivery.message,

    };

  }



  async getMe(userId: string) {

    const row = await this.usersRepository.findById(userId);

    if (!row) throw new UnauthorizedException('User not found');

    const response = authResponse(row, (u) => this.signToken(u));

    return this.attachProfileFields(response, userId);

  }



  private async attachProfileFields(

    response: ReturnType<typeof authResponse>,

    userId: string,

  ) {

    const profiles = await this.userProfileService.resolveProfiles(userId);

    const profileFields = this.userProfileService.toProfileFields(profiles);

    return {

      ...response,

      user: {

        ...(response.user as Record<string, unknown>),

        ...profileFields,

      },

    };

  }



  async updateMe(userId: string, dto: UpdateMeDto) {

    const row = await this.usersRepository.findById(userId);

    if (!row) throw new UnauthorizedException('User not found');



    if (dto.first_name !== undefined) row.firstName = dto.first_name;

    if (dto.last_name !== undefined) row.lastName = dto.last_name;



    if (dto.phone !== undefined) {

      try {

        validateBelarusPhone(dto.phone);

      } catch {

        throw new BadRequestException('Phone must match format +375 (29) 999-99-99');

      }

      const trimmed = dto.phone.trim();

      if (trimmed) {

        const phoneOwner = await this.usersRepository.findByPhone(trimmed);

        if (phoneOwner && phoneOwner.id !== row.id) {

          throw new ConflictException('Phone number already in use');

        }

      }

      row.phone = trimmed;

    }



    if (dto.telegram_id !== undefined) row.telegramId = dto.telegram_id;



    if (dto.email !== undefined) {

      const dashboardRole = getOnboardingContext(row).role;

      if (dashboardRole === 'admin') {

        throw new ForbiddenException('Administrators cannot change email via profile');

      }

      let normalizedEmail: string;

      try {

        normalizedEmail = validateRegistrationEmail(dto.email);

      } catch (error) {

        throw new BadRequestException((error as Error).message);

      }

      if (normalizedEmail !== row.email) {

        const existing = await this.usersRepository.findByEmail(normalizedEmail);

        if (existing && existing.id !== row.id) {

          throw new ConflictException('Email already in use');

        }

        row.email = normalizedEmail;

      }

    }



    if (dto.role !== undefined) {

      throw new ForbiddenException('Role changes must be made by an administrator');

    }



    row.updatedDate = new Date();



    const saved = await this.usersRepository.save(row);

    return this.attachProfileFields(authResponse(saved, (u) => this.signToken(u)), saved.id);

  }



  /** @deprecated Legacy flow for users created before PendingRegistration */

  async verifyCode(userId: string, code: string, clientIp: string) {

    this.rateLimit.assertAllowed(

      `verify-code:user:${userId}`,

      MAX_VERIFY_REQUESTS_PER_USER,

      VERIFY_RATE_WINDOW_MS,

      'Слишком много попыток проверки кода',

    );

    this.rateLimit.assertAllowed(

      `verify-code:ip:${clientIp}`,

      MAX_VERIFY_REQUESTS_PER_IP,

      VERIFY_RATE_WINDOW_MS,

      'Слишком много попыток проверки кода',

    );



    const row = await this.usersRepository.findById(userId);

    if (!row) throw new UnauthorizedException('User not found');



    const onboarding = getOnboardingContext(row);

    if (onboarding.onboarding_state !== 'needs_verification') {

      return this.attachProfileFields(authResponse(row, (u) => this.signToken(u)), row.id);

    }



    await this.verificationEmail.verifyCode(row, code);

    row.emailVerified = true;
    row.updatedDate = new Date();
    await this.usersRepository.save(row);

    await this.audit.log({

      actorUserId: userId,

      action: 'verify_code',

      entityType: 'User',

      entityId: userId,

      summary: 'Registration code verified',

    });



    const saved = await this.usersRepository.findById(userId);

    return authResponse(saved, (u) => this.signToken(u));

  }



  /** @deprecated Legacy flow for users created before PendingRegistration */

  async resendVerificationCode(userId: string) {

    const row = await this.usersRepository.findById(userId);

    if (!row) throw new UnauthorizedException('User not found');



    const onboarding = getOnboardingContext(row);

    if (onboarding.onboarding_state !== 'needs_verification') {

      throw new BadRequestException('Verification code is not required');

    }



    const emailDelivery = await this.verificationEmail.issueAndSend(row, {

      isResend: true,

    });



    await this.audit.log({

      actorUserId: userId,

      action: 'resend_code',

      entityType: 'User',

      entityId: userId,

      summary: 'Verification code regenerated',

    });



    return {

      success: emailDelivery.success,

      ok: emailDelivery.success,

      email_sent: emailDelivery.email_sent,

      email_status: emailDelivery.email_status,

      message: emailDelivery.message,

    };

  }



  async createTelegramLinkToken(userId: string) {

    const row = await this.usersRepository.findById(userId);

    if (!row) throw new UnauthorizedException('User not found');



    const onboarding = getOnboardingContext(row);

    if (!hasDashboardAccess(onboarding.onboarding_state) && onboarding.status !== 'active') {

      throw new ForbiddenException('Telegram linking requires an active account');

    }

    if (onboarding.status !== 'active') {

      throw new ForbiddenException('Telegram linking requires an active account');

    }



    const token = generateLinkToken();

    const expires = new Date(Date.now() + 15 * 60 * 1000);

    row.telegramLinkToken = token;

    row.telegramLinkExpires = expires;

    row.updatedDate = new Date();

    await this.usersRepository.save(row);



    const botUsername =

      this.config.get<string>('telegram.botUsername') || 'LonghuaChinese_bot';



    return {

      token,

      expires_at: expires.toISOString(),

      bot_username: botUsername,

      link_command: `/link ${token}`,

      deep_link: `https://t.me/${botUsername}?start=link_${token}`,

    };

  }



  async linkTelegramByToken(

    token: string,

    telegramId: string,

    telegramUsername?: string,

  ): Promise<boolean> {

    const row = await this.usersRepository.findByLinkToken(token);

    if (!row) return false;



    if (row.status !== 'active') return false;



    if (row.telegramLinkExpires && row.telegramLinkExpires < new Date()) {

      return false;

    }



    const existing = await this.usersRepository.findByTelegramId(telegramId);

    if (existing && existing.id !== row.id) {

      return false;

    }



    row.telegramId = telegramId;

    row.telegramUsername = telegramUsername ?? '';

    row.telegramLinkToken = null;

    row.telegramLinkExpires = null;

    row.updatedDate = new Date();

    await this.usersRepository.save(row);



    await this.audit.log({

      actorUserId: row.id,

      action: 'telegram_link',

      entityType: 'User',

      entityId: row.id,

      summary: `Telegram linked: @${telegramUsername ?? telegramId}`,

    });



    return true;

  }



  signToken(user: Record<string, unknown>): string {

    const payload: JwtPayload = {

      sub: String(user.id),

      email: String(user.email),

      role: user.role != null ? String(user.role) : '',

    };

    return this.jwtService.sign(payload);

  }

}


