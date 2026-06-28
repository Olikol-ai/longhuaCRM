import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { canSelfAssignRole } from '../../common/constants/roles';
import { UsersRepository } from '../users/users.repository';
import { userToRecord } from '../users/user.mapper';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateMeDto } from './dto/update-me.dto';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const row = await this.usersRepository.findByEmail(dto.email.trim().toLowerCase());
    if (!row || !bcrypt.compareSync(dto.password, row.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const user = userToRecord(row);
    return { token: this.signToken(user), user };
  }

  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const existing = await this.usersRepository.findByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const now = new Date();
    const id = randomUUID();
    const row = await this.usersRepository.save({
      id,
      email: normalizedEmail,
      passwordHash: bcrypt.hashSync(dto.password, 10),
      role: 'pending',
      firstName: dto.first_name ?? '',
      lastName: dto.last_name ?? '',
      phone: '',
      telegramId: '',
      createdDate: now,
      updatedDate: now,
    });

    const user = userToRecord(row);
    return { token: this.signToken(user), user };
  }

  async getMe(userId: string) {
    const row = await this.usersRepository.findById(userId);
    if (!row) throw new UnauthorizedException('User not found');
    const user = userToRecord(row);
    return { ...user, token: this.signToken(user) };
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    const row = await this.usersRepository.findById(userId);
    if (!row) throw new UnauthorizedException('User not found');

    if (dto.first_name !== undefined) row.firstName = dto.first_name;
    if (dto.last_name !== undefined) row.lastName = dto.last_name;
    if (dto.phone !== undefined) row.phone = dto.phone;
    if (dto.telegram_id !== undefined) row.telegramId = dto.telegram_id;

    if (dto.role !== undefined) {
      if (!canSelfAssignRole(row.role, dto.role)) {
        throw new ForbiddenException('Role change is not allowed');
      }
      row.role = dto.role;
    }

    row.updatedDate = new Date();

    const saved = await this.usersRepository.save(row);
    const user = userToRecord(saved);
    return { ...user, token: this.signToken(user) };
  }

  signToken(user: Record<string, unknown>): string {
    const payload: JwtPayload = {
      sub: String(user.id),
      email: String(user.email),
      role: String(user.role),
    };
    return this.jwtService.sign(payload);
  }
}
