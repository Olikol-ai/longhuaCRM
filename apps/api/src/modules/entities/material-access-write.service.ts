import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import {
  GrantedByRole,
  MaterialAccessEntity,
} from '../../entities/material-access.entity';

/**
 * Single source of truth for material access writes.
 * One row per (userId, materialId); grantedByRole is audit metadata only.
 */
@Injectable()
export class MaterialAccessWriteService {
  constructor(
    @InjectRepository(MaterialAccessEntity)
    private readonly accessRepo: Repository<MaterialAccessEntity>,
  ) {}

  async grantAccess(
    userId: string,
    materialId: string,
    auditRole: GrantedByRole,
  ): Promise<void> {
    const existing = await this.accessRepo.findOne({
      where: { userId, materialId },
    });

    if (existing) {
      existing.access = true;
      existing.grantedByRole = auditRole;
      existing.updatedDate = new Date();
      await this.accessRepo.save(existing);
      return;
    }

    const now = new Date();
    await this.accessRepo.save(
      this.accessRepo.create({
        id: randomUUID(),
        userId,
        materialId,
        grantedByRole: auditRole,
        access: true,
        createdDate: now,
        updatedDate: now,
      }),
    );
  }

  async revokeAccess(userId: string, materialId: string): Promise<void> {
    await this.accessRepo.delete({ userId, materialId });
  }

  async setAccess(
    userId: string,
    materialId: string,
    access: boolean,
    auditRole: GrantedByRole,
  ): Promise<void> {
    if (access) {
      await this.grantAccess(userId, materialId, auditRole);
      return;
    }
    await this.revokeAccess(userId, materialId);
  }
}
