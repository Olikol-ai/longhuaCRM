import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MaterialAccessEntity } from './entities/material-access.entity';

@Injectable()
export class MaterialAccessCheckService {
  constructor(
    @InjectRepository(MaterialAccessEntity)
    private readonly accessRepo: Repository<MaterialAccessEntity>,
  ) {}

  async hasAccess(userId: string, materialId: string, role?: string): Promise<boolean> {
    if (role === 'admin') {
      return true;
    }

    const row = await this.accessRepo.findOne({
      where: { userId, materialId, access: true },
    });
    return Boolean(row);
  }

  async canAccessMaterial(userId: string, materialId: string, role?: string): Promise<boolean> {
    return this.hasAccess(userId, materialId, role);
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
