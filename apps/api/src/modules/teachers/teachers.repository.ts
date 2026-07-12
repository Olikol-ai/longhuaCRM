import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { TeacherEntity } from './entities/teacher.entity';

@Injectable()
export class TeachersRepository {
  constructor(
    @InjectRepository(TeacherEntity)
    private readonly repo: Repository<TeacherEntity>,
  ) {}

  findAll(): Promise<TeacherEntity[]> {
    return this.repo.find();
  }

  findById(id: string): Promise<TeacherEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  exists(id: string): Promise<boolean> {
    return this.repo.exist({ where: { id } });
  }

  save(entity: Partial<TeacherEntity>): Promise<TeacherEntity> {
    return this.repo.save(this.repo.create(entity));
  }

  async update(id: string, data: Partial<TeacherEntity>): Promise<TeacherEntity | null> {
    await this.repo.update({ id }, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  filter(where: FindOptionsWhere<TeacherEntity>): Promise<TeacherEntity[]> {
    return this.repo.find({ where });
  }
}
