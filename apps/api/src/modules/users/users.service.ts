import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import { JwtPayload } from '../auth/auth.service';
import { toDbRole } from '../auth/onboarding';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { AuditService } from '../audit/audit.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ProfileRelationsService } from './profile-relations.service';
import { RoleEntitySyncService } from './role-entity-sync.service';
import {
  studentProfileToDirectoryEntry,
  teacherProfileToDirectoryEntry,
  userToDirectoryEntry,
} from './user-directory.mapper';
import { userToRecord } from './user.mapper';
import { UsersRepository } from './users.repository';
import { UserEntity } from './entities/user.entity';

const BLOCKED_UPDATE_FIELDS = new Set([
  'id',
  'passwordHash',
  'password_hash',
  'email',
  'createdDate',
  'updatedDate',
  'created_date',
  'updated_date',
]);

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly audit: AuditService,
    private readonly roleEntitySync: RoleEntitySyncService,
    private readonly profileRelations: ProfileRelationsService,
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async list(): Promise<Record<string, unknown>[]> {
    const users = await this.usersRepository.findAll();
    return users.filter((user) => user.status !== 'blocked').map(userToRecord);
  }

  async listDirectory(): Promise<Record<string, unknown>[]> {
    const [users, students, teachers] = await Promise.all([
      this.usersRepository.findAll(),
      this.studentRepo.find({ where: { status: Not('inactive') } }),
      this.teacherRepo.find({ where: { status: Not('inactive') } }),
    ]);

    const activeUsers = users.filter((user) => user.status !== 'blocked');

    const studentByUserId = new Map(
      students.filter((row) => row.userId).map((row) => [row.userId as string, row]),
    );
    const teacherByUserId = new Map(
      teachers.filter((row) => row.userId).map((row) => [row.userId as string, row]),
    );

    const entries: Record<string, unknown>[] = activeUsers.map((user) =>
      userToDirectoryEntry(
        user,
        studentByUserId.get(user.id) ?? null,
        teacherByUserId.get(user.id) ?? null,
      ),
    );

    for (const student of students.filter((row) => !row.userId)) {
      entries.push(studentProfileToDirectoryEntry(student));
    }

    for (const teacher of teachers.filter((row) => !row.userId)) {
      entries.push(teacherProfileToDirectoryEntry(teacher));
    }

    return entries.sort((a, b) => {
      const nameA = String(a.full_name ?? a.email ?? '').toLowerCase();
      const nameB = String(b.full_name ?? b.email ?? '').toLowerCase();
      return nameA.localeCompare(nameB, 'ru');
    });
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actor: JwtPayload,
  ): Promise<Record<string, unknown>> {
    for (const key of Object.keys(dto)) {
      if (BLOCKED_UPDATE_FIELDS.has(key)) {
        throw new ForbiddenException(`Field "${key}" cannot be updated`);
      }
    }

    const { saved, roleChanged } = await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(UserEntity);
      const row = await userRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) {
        throw new NotFoundException('User not found');
      }

      const prevRole = row.role;
      const prevStatus = row.status;

      if (dto.role !== undefined) {
        row.role = toDbRole(String(dto.role));
      }
      if (dto.status !== undefined) {
        row.status = String(dto.status);
      }
      if (dto.firstName !== undefined) {
        row.firstName = String(dto.firstName);
      }
      if (dto.lastName !== undefined) {
        row.lastName = String(dto.lastName);
      }
      if (dto.phone !== undefined) {
        row.phone = String(dto.phone);
      }
      if (dto.telegramId !== undefined) {
        row.telegramId = String(dto.telegramId);
      }

      if (
        dto.role !== undefined &&
        ['admin', 'teacher', 'student'].includes(String(dto.role))
      ) {
        row.status = 'active';
        row.verificationCode = null;
        row.verificationCodeExpiresAt = null;
        row.verificationCodeSentAt = null;
        row.verificationAttempts = 0;
      }

      row.updatedDate = new Date();
      const persisted = await userRepo.save(row);

      const changedRole = dto.role !== undefined && persisted.role !== prevRole;

      if (changedRole) {
        await this.audit.log({
          actorUserId: actor.sub,
          action: 'role_change',
          entityType: 'User',
          entityId: id,
          summary: `role: "${prevRole}" → "${persisted.role}"`,
        });
      }

      if (dto.status !== undefined && persisted.status !== prevStatus) {
        await this.audit.log({
          actorUserId: actor.sub,
          action: 'status_change',
          entityType: 'User',
          entityId: id,
          summary: `status: "${prevStatus}" → "${persisted.status}"`,
        });
      }

      return { saved: persisted, roleChanged: changedRole };
    });

    if (roleChanged) {
      await this.roleEntitySync.syncAfterRoleChange(saved, saved.role);
    } else if (dto.firstName !== undefined || dto.lastName !== undefined) {
      await this.roleEntitySync.syncLinkedProfilesFromUser(saved);
    }

    return userToRecord(saved);
  }

  async delete(id: string): Promise<{ ok: true; orphanStudents: unknown[] }> {
    const row = await this.usersRepository.findById(id);
    if (!row) {
      throw new NotFoundException('User not found');
    }
    const { orphanStudents } = await this.profileRelations.deleteProfilesForUser(id);
    await this.usersRepository.delete(id);
    return { ok: true, orphanStudents };
  }

  findById(id: string): Promise<UserEntity | null> {
    return this.usersRepository.findById(id);
  }
}
