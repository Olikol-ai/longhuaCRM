import { Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { StudentAccessService } from '../../common/access/student-access.service';
import { JwtPayload } from '../auth/auth.service';
import { RoleEntitySyncService } from '../users/role-entity-sync.service';
import { UsersRepository } from '../users/users.repository';
import { StudentEntity } from './entities/student.entity';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentsRepository } from './students.repository';

@Injectable()
export class StudentsService {
  constructor(
    private readonly repository: StudentsRepository,
    private readonly studentAccess: StudentAccessService,
    private readonly roleEntitySync: RoleEntitySyncService,
    private readonly usersRepository: UsersRepository,
  ) {}

  async findAll(actor: JwtPayload): Promise<StudentEntity[]> {
    const where = await this.studentAccess.scopeStudentFilter(actor, {});
    return this.repository.filter(where as FindOptionsWhere<StudentEntity>);
  }

  async findById(actor: JwtPayload, id: string): Promise<StudentEntity> {
    await this.studentAccess.assertCanReadStudent(actor, id);
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundException('Student not found');
    }
    return row;
  }

  async create(dto: CreateStudentDto): Promise<StudentEntity> {
    const payload: Record<string, unknown> = { ...dto };

    if (dto.email?.trim() && !dto.userId) {
      const user = await this.usersRepository.findByEmail(dto.email.trim().toLowerCase());
      if (user) {
        payload.userId = user.id;
      }
    }

    return this.roleEntitySync.upsertStudentFromCreate(payload);
  }

  async update(actor: JwtPayload, id: string, dto: UpdateStudentDto): Promise<StudentEntity> {
    const payload = await this.studentAccess.assertCanUpdateStudent(
      actor,
      id,
      dto as Record<string, unknown>,
    );
    const row = await this.repository.update(id, payload as UpdateStudentDto);
    if (!row) {
      throw new NotFoundException('Student not found');
    }
    return row;
  }

  async delete(id: string): Promise<void> {
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundException('Student not found');
    }
    await this.repository.delete(id);
  }

  async filter(actor: JwtPayload, where: Record<string, unknown>): Promise<StudentEntity[]> {
    const scoped = await this.studentAccess.scopeStudentFilter(actor, where);
    return this.repository.filter(scoped as FindOptionsWhere<StudentEntity>);
  }
}
