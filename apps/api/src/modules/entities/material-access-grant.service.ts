import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { MaterialAccessEntity } from '../../entities/MaterialAccess.entity';
import { EntityAccessContext } from './entity-access.types';

@Injectable()
export class MaterialAccessGrantService {
  constructor(
    @InjectRepository(MaterialAccessEntity)
    private readonly accessRepo: Repository<MaterialAccessEntity>,
  ) {}

  async grantCreatorAccess(
    materialId: string,
    context: EntityAccessContext,
  ): Promise<void> {
    if (context.role !== 'teacher' && context.role !== 'admin') {
      return;
    }

    const grantedByRole = context.role === 'admin' ? 'ADMIN' : 'TEACHER';
    const existing = await this.accessRepo.findOne({
      where: {
        userId: context.userId,
        materialId,
        grantedByRole,
      },
    });

    if (existing) {
      if (!existing.access) {
        existing.access = true;
        existing.updatedDate = new Date();
        await this.accessRepo.save(existing);
      }
      return;
    }

    const now = new Date();
    await this.accessRepo.save(
      this.accessRepo.create({
        id: randomUUID(),
        userId: context.userId,
        materialId,
        grantedByRole,
        access: true,
        createdDate: now,
        updatedDate: now,
      }),
    );
  }
}
