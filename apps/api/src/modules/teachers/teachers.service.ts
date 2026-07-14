import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { TeacherAccessService } from '../../common/access/teacher-access.service';
import { JwtPayload } from '../auth/auth.service';
import { UserEntity } from '../users/entities/user.entity';
import { TeacherEntity } from './entities/teacher.entity';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { TeacherDeleteResult, TeacherDeletionService } from './teacher-deletion.service';
import { TeachersRepository } from './teachers.repository';

@Injectable()
export class TeachersService {
  constructor(
    private readonly repository: TeachersRepository,
    private readonly teacherAccess: TeacherAccessService,
    private readonly teacherDeletion: TeacherDeletionService,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async findAll(actor: JwtPayload): Promise<TeacherEntity[]> {
    const where = await this.teacherAccess.scopeTeacherFilter(actor, {});
    const rows = await this.repository.filter(where as FindOptionsWhere<TeacherEntity>);
    return this.applyUserTelegram(rows);
  }

  async findById(actor: JwtPayload, id: string): Promise<TeacherEntity> {
    await this.teacherAccess.assertCanReadTeacher(actor, id);
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundException('Teacher not found');
    }
    const [enriched] = await this.applyUserTelegram([row]);
    return enriched;
  }

  create(dto: CreateTeacherDto): Promise<TeacherEntity> {
    return this.repository.save(dto);
  }

  async update(actor: JwtPayload, id: string, dto: UpdateTeacherDto): Promise<TeacherEntity> {
    const payload = await this.teacherAccess.assertCanUpdateTeacher(
      actor,
      id,
      dto as Record<string, unknown>,
    );
    const row = await this.repository.update(id, payload as UpdateTeacherDto);
    if (!row) {
      throw new NotFoundException('Teacher not found');
    }
    return row;
  }

  delete(id: string): Promise<TeacherDeleteResult> {
    return this.teacherDeletion.deleteTeacher(id);
  }

  async filter(actor: JwtPayload, where: Record<string, unknown>): Promise<TeacherEntity[]> {
    const scoped = await this.teacherAccess.scopeTeacherFilter(actor, where);
    const rows = await this.repository.filter(scoped as FindOptionsWhere<TeacherEntity>);
    return this.applyUserTelegram(rows);
  }

  /** Prefer linked User.telegram_id for API responses (source of truth). */
  private async applyUserTelegram(rows: TeacherEntity[]): Promise<TeacherEntity[]> {
    const userIds = [
      ...new Set(rows.map((row) => row.userId).filter((id): id is string => Boolean(id))),
    ];
    if (userIds.length === 0) {
      return rows;
    }

    const users = await this.userRepo.find({ where: { id: In(userIds) } });
    const byId = new Map(users.map((user) => [user.id, user]));

    for (const row of rows) {
      if (!row.userId) continue;
      const user = byId.get(row.userId);
      const telegramId = (user?.telegramId ?? '').trim();
      if (!telegramId) continue;
      row.telegramId = telegramId;
    }
    return rows;
  }
}
