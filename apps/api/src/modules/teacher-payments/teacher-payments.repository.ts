import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { TeacherPaymentEntity } from './entities/teacher-payment.entity';

@Injectable()
export class TeacherPaymentsRepository {
  constructor(
    @InjectRepository(TeacherPaymentEntity)
    private readonly repo: Repository<TeacherPaymentEntity>,
  ) {}

  findAll(): Promise<TeacherPaymentEntity[]> {
    return this.repo.find();
  }

  findById(id: string): Promise<TeacherPaymentEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByLessonId(lessonId: string): Promise<TeacherPaymentEntity | null> {
    return this.repo.findOne({ where: { lessonId } });
  }

  save(entity: Partial<TeacherPaymentEntity>): Promise<TeacherPaymentEntity> {
    return this.repo.save(this.repo.create(entity));
  }

  saveWithManager(
    manager: EntityManager,
    entity: Partial<TeacherPaymentEntity>,
  ): Promise<TeacherPaymentEntity> {
    const repo = manager.getRepository(TeacherPaymentEntity);
    return repo.save(repo.create(entity));
  }

  async update(id: string, data: Partial<TeacherPaymentEntity>): Promise<TeacherPaymentEntity | null> {
    await this.repo.update({ id }, data);
    return this.findById(id);
  }

  filter(where: FindOptionsWhere<TeacherPaymentEntity>): Promise<TeacherPaymentEntity[]> {
    return this.repo.find({ where });
  }
}
