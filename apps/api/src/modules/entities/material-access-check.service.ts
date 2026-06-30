import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MaterialAccessEntity } from '../../entities/MaterialAccess.entity';
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

    const accesses = await this.accessRepo.find({
      where: { userId, materialId },
    });

    return this.evaluateAccessRows(accesses);
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

    const accesses = await this.accessRepo.find({
      where: { userId, materialId: In(materialIds) },
    });

    const byMaterial = new Map<string, MaterialAccessEntity[]>();
    for (const row of accesses) {
      const list = byMaterial.get(row.materialId) ?? [];
      list.push(row);
      byMaterial.set(row.materialId, list);
    }

    const allowed = new Set<string>();
    for (const materialId of materialIds) {
      if (this.evaluateAccessRows(byMaterial.get(materialId) ?? [])) {
        allowed.add(materialId);
      }
    }
    return allowed;
  }

  private evaluateAccessRows(accesses: MaterialAccessEntity[]): boolean {
    const adminDeny = accesses.find(
      (a) => a.grantedByRole === 'ADMIN' && a.access === false,
    );
    if (adminDeny) return false;

    const adminAllow = accesses.find(
      (a) => a.grantedByRole === 'ADMIN' && a.access === true,
    );
    if (adminAllow) return true;

    const teacherAllow = accesses.find(
      (a) => a.grantedByRole === 'TEACHER' && a.access === true,
    );
    if (teacherAllow) return true;

    return false;
  }
}
