import { Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { MaterialsDomainAccessService } from '../../common/access/materials-domain-access.service';
import { JwtPayload } from '../auth/auth.service';
import { GrantedByRole } from './entities/material-access.entity';
import { MaterialEntity } from './entities/material.entity';
import { MaterialFolderEntity } from './entities/material-folder.entity';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateMaterialFolderDto } from './dto/create-material-folder.dto';
import { SyncMaterialAccessDto } from './dto/sync-material-access.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { UpdateMaterialFolderDto } from './dto/update-material-folder.dto';
import { MaterialsRepository } from './materials.repository';

@Injectable()
export class MaterialsService {
  constructor(
    private readonly repository: MaterialsRepository,
    private readonly materialsAccess: MaterialsDomainAccessService,
  ) {}

  async findAllMaterials(actor: JwtPayload): Promise<MaterialEntity[]> {
    const where = await this.materialsAccess.scopeMaterialFilter(actor, {});
    const rows = await this.repository.filterMaterials(where as FindOptionsWhere<MaterialEntity>);
    return this.attachCourseIds(rows);
  }

  async findMaterialById(actor: JwtPayload, id: string): Promise<MaterialEntity> {
    await this.materialsAccess.assertCanReadMaterial(actor, id);
    const row = await this.repository.findMaterialById(id);
    if (!row) {
      throw new NotFoundException('Material not found');
    }
    const [enriched] = await this.attachCourseIds([row]);
    return enriched;
  }

  createMaterial(dto: CreateMaterialDto): Promise<MaterialEntity> {
    return this.repository.saveMaterial(dto);
  }

  async updateMaterial(id: string, dto: UpdateMaterialDto): Promise<MaterialEntity> {
    const row = await this.repository.updateMaterial(id, dto);
    if (!row) {
      throw new NotFoundException('Material not found');
    }
    return row;
  }

  async deleteMaterial(id: string): Promise<void> {
    const row = await this.repository.findMaterialById(id);
    if (!row) {
      throw new NotFoundException('Material not found');
    }
    await this.repository.deleteMaterial(id);
  }

  async filterMaterials(
    actor: JwtPayload,
    where: Record<string, unknown>,
  ): Promise<MaterialEntity[]> {
    const scoped = await this.materialsAccess.scopeMaterialFilter(actor, where);
    const rows = await this.repository.filterMaterials(scoped as FindOptionsWhere<MaterialEntity>);
    return this.attachCourseIds(rows);
  }

  private async attachCourseIds(materials: MaterialEntity[]): Promise<MaterialEntity[]> {
    if (materials.length === 0) {
      return materials;
    }

    const folderIds = [...new Set(materials.map((row) => row.folderId))];
    const folders = await this.repository.findFoldersByIds(folderIds);
    const courseByFolder = new Map(folders.map((folder) => [folder.id, folder.courseTemplateId]));

    return materials.map((material) =>
      Object.assign(Object.create(Object.getPrototypeOf(material)), material, {
        courseId: courseByFolder.get(material.folderId) ?? null,
      }),
    );
  }

  async findAllFolders(actor: JwtPayload): Promise<MaterialFolderEntity[]> {
    const where = await this.materialsAccess.scopeFolderFilter(actor, {});
    return this.repository.filterFolders(where as FindOptionsWhere<MaterialFolderEntity>);
  }

  async findFolderById(actor: JwtPayload, id: string): Promise<MaterialFolderEntity> {
    const row = await this.repository.findFolderById(id);
    if (!row) {
      throw new NotFoundException('Material folder not found');
    }
    if (!this.materialsAccess.isAdmin(actor) && row.courseTemplateId) {
      const folders = await this.findAllFolders(actor);
      if (!folders.some((folder) => folder.id === id)) {
        throw new NotFoundException('Material folder not found');
      }
    }
    return row;
  }

  createFolder(dto: CreateMaterialFolderDto): Promise<MaterialFolderEntity> {
    return this.repository.saveFolder(dto);
  }

  async updateFolder(id: string, dto: UpdateMaterialFolderDto): Promise<MaterialFolderEntity> {
    const row = await this.repository.updateFolder(id, dto);
    if (!row) {
      throw new NotFoundException('Material folder not found');
    }
    return row;
  }

  async deleteFolder(id: string): Promise<void> {
    const row = await this.repository.findFolderById(id);
    if (!row) {
      throw new NotFoundException('Material folder not found');
    }
    await this.repository.deleteFolder(id);
  }

  async filterFolders(
    actor: JwtPayload,
    where: Record<string, unknown>,
  ): Promise<MaterialFolderEntity[]> {
    const scoped = await this.materialsAccess.scopeFolderFilter(actor, where);
    return this.repository.filterFolders(
      this.normalizeFolderWhere(scoped) as FindOptionsWhere<MaterialFolderEntity>,
    );
  }

  private normalizeFolderWhere(where: Record<string, unknown>): Record<string, unknown> {
    const out = { ...where };
    if (out.courseId !== undefined && out.courseTemplateId === undefined) {
      out.courseTemplateId = out.courseId;
      delete out.courseId;
    }
    return out;
  }

  async syncAccess(
    dto: SyncMaterialAccessDto,
    grantedByRole: GrantedByRole = 'ADMIN',
  ): Promise<{ grantedCount: number; revokedCount: number }> {
    const role = dto.grantedByRole ?? grantedByRole;
    const requestedSet = new Set(dto.materialIds);
    const currentRows = await this.repository.findAccessByUserId(dto.userId);
    const currentGranted = new Set(
      currentRows.filter((row) => row.access).map((row) => row.materialId),
    );

    let grantedCount = 0;
    let revokedCount = 0;

    for (const materialId of requestedSet) {
      const material = await this.repository.findMaterialById(materialId);
      if (!material) {
        throw new NotFoundException('Material not found');
      }
      if (!currentGranted.has(materialId)) {
        const existing = await this.repository.findAccessByUserAndMaterial(
          dto.userId,
          materialId,
        );
        if (existing) {
          await this.repository.saveAccess({ ...existing, access: true, grantedByRole: role });
        } else {
          await this.repository.saveAccess({
            userId: dto.userId,
            materialId,
            access: true,
            grantedByRole: role,
          });
        }
        grantedCount += 1;
      }
    }

    for (const materialId of currentGranted) {
      if (!requestedSet.has(materialId)) {
        const existing = await this.repository.findAccessByUserAndMaterial(
          dto.userId,
          materialId,
        );
        if (existing) {
          await this.repository.saveAccess({ ...existing, access: false });
          revokedCount += 1;
        }
      }
    }

    return { grantedCount, revokedCount };
  }
}
