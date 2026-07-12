import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PendingRegistrationEntity } from './entities/pending-registration.entity';

@Injectable()
export class PendingRegistrationRepository {
  constructor(
    @InjectRepository(PendingRegistrationEntity)
    private readonly repo: Repository<PendingRegistrationEntity>,
  ) {}

  findByEmail(email: string): Promise<PendingRegistrationEntity | null> {
    return this.repo.findOne({ where: { email } });
  }

  findByPhone(phone: string): Promise<PendingRegistrationEntity | null> {
    const trimmed = phone?.trim();
    if (!trimmed) return Promise.resolve(null);
    return this.repo.findOne({ where: { phone: trimmed } });
  }

  findById(id: string): Promise<PendingRegistrationEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  save(entity: PendingRegistrationEntity): Promise<PendingRegistrationEntity> {
    return this.repo.save(entity);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  async deleteExpiredUncompleted(createdBefore: Date): Promise<number> {
    const result = await this.repo
      .createQueryBuilder()
      .delete()
      .from(PendingRegistrationEntity)
      .where('"created_date" < :createdBefore', { createdBefore })
      .andWhere('status IN (:...statuses)', { statuses: ['pending', 'blocked'] })
      .execute();
    return result.affected ?? 0;
  }
}
