import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MaterialAccessEntity } from '../../entities/material-access.entity';
import { EntityAccessContext } from './entity-access.types';

@Injectable()
export class MaterialAccessCheckService {
  constructor(
    @InjectRepository(MaterialAccessEntity)
    private readonly accessRepo: Repository<MaterialAccessEntity>,
  ) {}

  async hasAccess(
    userId: string,
    materialId: string,
    role?: string,
  ): Promise<boolean> {
    if (role === 'admin') {
      return true;
    }

    const row = await this.accessRepo.findOne({
      where: { userId, materialId, access: true },
    });
    return Boolean(row);
  }

  async canAccessMaterial(
    userId: string,
    materialId: string,
    role?: string,
  ): Promise<boolean> {
    return this.hasAccess(userId, materialId, role);
  }

  /** @deprecated Use canAccessMaterial */
  async canReadMaterial(
    context: EntityAccessContext,
    materialId: string,
  ): Promise<boolean> {
    return this.hasAccess(context.userId, materialId, context.role);
  }

  async filterReadableMaterials(
    context: EntityAccessContext,
    records: Record<string, unknown>[],
  ): Promise<Record<string, unknown>[]> {
    if (context.role === 'admin' || records.length === 0) {
      return records;
    }

    const materialIds = records
      .map((record) => String(record.id ?? ''))
      .filter(Boolean);
    const allowed = await this.filterAccessibleMaterialIds(
      context.userId,
      materialIds,
      context.role,
    );

    return records.filter((record) => allowed.has(String(record.id ?? '')));
  }

  async filterAccessibleMaterialIds(
    userId: string,
    materialIds: string[],
    role?: string,
  ): Promise<Set<string>> {
    if (role === 'admin' || materialIds.length === 0) {
      return new Set(materialIds);
    }

    const rows = await this.accessRepo.find({
      where: { userId, materialId: In(materialIds), access: true },
    });

    return new Set(rows.map((row) => row.materialId));
  }

  async getGrantedMaterialIds(userId: string): Promise<Set<string>> {
    const rows = await this.accessRepo.find({
      where: { userId, access: true },
    });
    return new Set(rows.map((row) => row.materialId));
  }
}
