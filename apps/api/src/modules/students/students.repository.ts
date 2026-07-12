import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { StudentEntity } from './entities/student.entity';

@Injectable()
export class StudentsRepository {
  constructor(
    @InjectRepository(StudentEntity)
    private readonly repo: Repository<StudentEntity>,
  ) {}

  findAll(): Promise<StudentEntity[]> {
    return this.repo.find();
  }

  findById(id: string): Promise<StudentEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  save(entity: Partial<StudentEntity>): Promise<StudentEntity> {
    return this.repo.save(this.repo.create(entity));
  }

  async update(id: string, data: Partial<StudentEntity>): Promise<StudentEntity | null> {
    await this.repo.update({ id }, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  filter(where: FindOptionsWhere<StudentEntity>): Promise<StudentEntity[]> {
    return this.repo.find({ where });
  }
}
