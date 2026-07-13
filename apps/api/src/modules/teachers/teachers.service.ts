import { Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { TeacherAccessService } from '../../common/access/teacher-access.service';
import { JwtPayload } from '../auth/auth.service';
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
  ) {}

  async findAll(actor: JwtPayload): Promise<TeacherEntity[]> {
    const where = await this.teacherAccess.scopeTeacherFilter(actor, {});
    return this.repository.filter(where as FindOptionsWhere<TeacherEntity>);
  }

  async findById(actor: JwtPayload, id: string): Promise<TeacherEntity> {
    await this.teacherAccess.assertCanReadTeacher(actor, id);
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundException('Teacher not found');
    }
    return row;
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
    return this.repository.filter(scoped as FindOptionsWhere<TeacherEntity>);
  }
}
