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
import { randomBytes, randomInt, randomUUID } from 'crypto';
import { validateRegistrationEmail } from '../../common/security/email-validation';
import { RateLimitService } from '../../common/security/rate-limit.service';
import { AuditService } from '../audit/audit.service';
import { UsersRepository } from '../users/users.repository';
import { userToRecord } from '../users/user.mapper';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import {
  getOnboardingContext,
  hasDashboardAccess,
  toDbRole,
  validateBelarusPhone,
} from './onboarding';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

const MAX_VERIFY_ATTEMPTS = 5;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;
const RESEND_CODE_WINDOW_MS = 60 * 60 * 1000;

function generateVerificationCode(): string {
  return String(randomInt(100000, 999999));
}

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
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly rateLimit: RateLimitService,
    private readonly audit: AuditService,
  ) {}

  async login(dto: LoginDto, clientIp: string) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    this.rateLimit.assertAllowed(`login-ip:${clientIp}`, MAX_LOGIN_ATTEMPTS, LOGIN_WINDOW_MS);
    this.rateLimit.assertAllowed(`login:${normalizedEmail}`, MAX_LOGIN_ATTEMPTS, LOGIN_WINDOW_MS);

    const row = await this.usersRepository.findByEmail(normalizedEmail);
    if (!row || !bcrypt.compareSync(dto.password, row.passwordHash)) {
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

    return authResponse(row, (u) => this.signToken(u));
  }

  async register(dto: RegisterDto, clientIp: string) {
    this.rateLimit.assertAllowed(`register-ip:${clientIp}`, 5, REGISTER_WINDOW_MS);

    let normalizedEmail: string;
    try {
      normalizedEmail = validateRegistrationEmail(dto.email);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    this.rateLimit.assertAllowed(`register:${normalizedEmail}`, 3, REGISTER_WINDOW_MS);

    const existing = await this.usersRepository.findByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictException('Email already registered');
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
    }

    const now = new Date();
    const id = randomUUID();
    const verificationCode = generateVerificationCode();
    const row = await this.usersRepository.save({
      id,
      email: normalizedEmail,
      passwordHash: bcrypt.hashSync(dto.password, 10),
      role: '',
      status: 'pending',
      verificationCode,
      verificationAttempts: 0,
      firstName: dto.first_name ?? '',
      lastName: dto.last_name ?? '',
      phone,
      telegramId: '',
      telegramUsername: '',
      telegramLinkToken: null,
      telegramLinkExpires: null,
      createdDate: now,
      updatedDate: now,
    });

    const response = authResponse(row, (u) => this.signToken(u));
    return {
      ...response,
      verification_code: verificationCode,
    };
  }

  async getMe(userId: string) {
    const row = await this.usersRepository.findById(userId);
    if (!row) throw new UnauthorizedException('User not found');
    return authResponse(row, (u) => this.signToken(u));
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
    return authResponse(saved, (u) => this.signToken(u));
  }

  async verifyCode(userId: string, code: string) {
    const row = await this.usersRepository.findById(userId);
    if (!row) throw new UnauthorizedException('User not found');

    const onboarding = getOnboardingContext(row);
    if (onboarding.onboarding_state !== 'needs_verification') {
      return authResponse(row, (u) => this.signToken(u));
    }

    if ((row.verificationAttempts ?? 0) >= MAX_VERIFY_ATTEMPTS) {
      throw new ForbiddenException('Too many verification attempts. Request a new code.');
    }

    if (!row.verificationCode || row.verificationCode !== code.trim()) {
      row.verificationAttempts = (row.verificationAttempts ?? 0) + 1;
      row.updatedDate = new Date();
      await this.usersRepository.save(row);
      const remaining = MAX_VERIFY_ATTEMPTS - row.verificationAttempts;
      throw new BadRequestException(
        remaining > 0
          ? `Invalid verification code. ${remaining} attempt(s) remaining.`
          : 'Invalid verification code. Request a new code.',
      );
    }

    row.status = 'active';
    row.verificationCode = null;
    row.verificationAttempts = 0;
    row.updatedDate = new Date();
    const saved = await this.usersRepository.save(row);

    await this.audit.log({
      actorUserId: userId,
      action: 'verify_code',
      entityType: 'User',
      entityId: userId,
      summary: 'Registration code verified',
    });

    return authResponse(saved, (u) => this.signToken(u));
  }

  async resendVerificationCode(userId: string) {
    this.rateLimit.assertAllowed(`resend-code:${userId}`, 3, RESEND_CODE_WINDOW_MS);

    const row = await this.usersRepository.findById(userId);
    if (!row) throw new UnauthorizedException('User not found');

    const onboarding = getOnboardingContext(row);
    if (onboarding.onboarding_state !== 'needs_verification') {
      throw new BadRequestException('Verification code is not required');
    }

    const verificationCode = generateVerificationCode();
    row.verificationCode = verificationCode;
    row.verificationAttempts = 0;
    row.updatedDate = new Date();
    await this.usersRepository.save(row);

    await this.audit.log({
      actorUserId: userId,
      action: 'resend_code',
      entityType: 'User',
      entityId: userId,
      summary: 'Verification code regenerated',
    });

    return { ok: true, verification_code: verificationCode };
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
