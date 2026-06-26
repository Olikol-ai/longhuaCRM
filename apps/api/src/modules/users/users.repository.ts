import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { UserEntity } from '../../entities/user.entity';

@Injectable()
export class UsersRepository implements OnModuleInit {
  private readonly logger = new Logger(UsersRepository.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.seedDefaultAdmin();
  }

  findAll(): Promise<UserEntity[]> {
    return this.usersRepo.find();
  }

  findByEmail(email: string): Promise<UserEntity | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  findById(id: string): Promise<UserEntity | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async save(user: UserEntity): Promise<UserEntity> {
    return this.usersRepo.save(user);
  }

  async delete(id: string): Promise<void> {
    await this.usersRepo.delete({ id });
  }

  private async seedDefaultAdmin() {
    const email = this.config.get<string>('admin.email') ?? 'admin@longhua.local';
    const existing = await this.findByEmail(email);
    if (existing) return;

    const password = this.config.get<string>('admin.password');
    if (!password) {
      this.logger.warn('ADMIN_PASSWORD is not set; default admin was not created');
      return;
    }

    const now = new Date();
    await this.save({
      id: randomUUID(),
      email,
      passwordHash: bcrypt.hashSync(password, 10),
      role: 'admin',
      firstName: 'Admin',
      lastName: 'Longhua',
      phone: '',
      telegramId: '',
      createdDate: now,
      updatedDate: now,
    });
    this.logger.log(`Default admin created: ${email}`);
  }
}
