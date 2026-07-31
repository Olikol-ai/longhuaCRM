import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { MaterialAccessEntity } from './entities/material-access.entity';
import { MaterialEntity } from './entities/material.entity';
import { MaterialFolderEntity } from './entities/material-folder.entity';
import { MaterialLinkEntity } from './entities/material-link.entity';

@Injectable()
export class MaterialsRepository {
  constructor(
    @InjectRepository(MaterialEntity)
    private readonly materialRepo: Repository<MaterialEntity>,
    @InjectRepository(MaterialFolderEntity)
    private readonly folderRepo: Repository<MaterialFolderEntity>,
    @InjectRepository(MaterialAccessEntity)
    private readonly accessRepo: Repository<MaterialAccessEntity>,
    @InjectRepository(MaterialLinkEntity)
    private readonly linkRepo: Repository<MaterialLinkEntity>,
  ) {}

  findAllMaterials(): Promise<MaterialEntity[]> {
    return this.materialRepo.find({ where: { status: 'active' } });
  }

  findMaterialById(id: string): Promise<MaterialEntity | null> {
    return this.materialRepo.findOne({ where: { id } });
  }

  saveMaterial(entity: Partial<MaterialEntity>): Promise<MaterialEntity> {
    return this.materialRepo.save(
      this.materialRepo.create({ status: 'active', ...entity }),
    );
  }

  async updateMaterial(id: string, data: Partial<MaterialEntity>): Promise<MaterialEntity | null> {
    await this.materialRepo.update({ id }, data);
    return this.findMaterialById(id);
  }

  async deleteMaterial(id: string): Promise<void> {
    await this.materialRepo.delete({ id });
  }

  filterMaterials(where: FindOptionsWhere<MaterialEntity>): Promise<MaterialEntity[]> {
    const scoped: FindOptionsWhere<MaterialEntity> = {
      ...where,
      status: (where as { status?: MaterialEntity['status'] }).status ?? 'active',
    };
    // List metadata only (no file content). fileUrl is a path/link for on-demand open.
    return this.materialRepo.find({
      where: scoped,
      select: [
        'id',
        'folderId',
        'title',
        'fileUrl',
        'fileType',
        'description',
        'status',
        'createdByUserId',
        'createdAt',
        'updatedAt',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  countLinksByMaterialId(materialId: string): Promise<number> {
    return this.linkRepo.count({ where: { materialId } });
  }

  countAccessByMaterialId(materialId: string): Promise<number> {
    return this.accessRepo.count({ where: { materialId } });
  }

  async revokeAllAccessForMaterial(materialId: string): Promise<number> {
    const result = await this.accessRepo.update({ materialId, access: true }, { access: false });
    return result.affected ?? 0;
  }

  async deleteAccessByMaterialId(materialId: string): Promise<void> {
    await this.accessRepo.delete({ materialId });
  }

  findFoldersByIds(ids: string[]): Promise<MaterialFolderEntity[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.folderRepo.find({ where: { id: In(ids) } });
  }

  findAllFolders(): Promise<MaterialFolderEntity[]> {
    return this.folderRepo.find({ order: { sortOrder: 'ASC' } });
  }

  findFolderById(id: string): Promise<MaterialFolderEntity | null> {
    return this.folderRepo.findOne({ where: { id } });
  }

  saveFolder(entity: Partial<MaterialFolderEntity>): Promise<MaterialFolderEntity> {
    return this.folderRepo.save(this.folderRepo.create(entity));
  }

  async updateFolder(
    id: string,
    data: Partial<MaterialFolderEntity>,
  ): Promise<MaterialFolderEntity | null> {
    await this.folderRepo.update({ id }, data);
    return this.findFolderById(id);
  }

  async deleteFolder(id: string): Promise<void> {
    await this.folderRepo.delete({ id });
  }

  filterFolders(where: FindOptionsWhere<MaterialFolderEntity>): Promise<MaterialFolderEntity[]> {
    return this.folderRepo.find({
      where,
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  findAccessByUserId(userId: string): Promise<MaterialAccessEntity[]> {
    return this.accessRepo.find({ where: { userId } });
  }

  findAccessByUserAndMaterial(
    userId: string,
    materialId: string,
  ): Promise<MaterialAccessEntity | null> {
    return this.accessRepo.findOne({ where: { userId, materialId } });
  }

  saveAccess(entity: Partial<MaterialAccessEntity>): Promise<MaterialAccessEntity> {
    return this.accessRepo.save(this.accessRepo.create(entity));
  }

  async deleteAccess(id: string): Promise<void> {
    await this.accessRepo.delete({ id });
  }

  async deleteAccessByUserAndMaterials(userId: string, materialIds: string[]): Promise<void> {
    if (materialIds.length === 0) {
      return;
    }
    await this.accessRepo.delete({ userId, materialId: In(materialIds) });
  }

  findAllLinks(): Promise<MaterialLinkEntity[]> {
    return this.linkRepo.find();
  }

  findLinksByMaterialId(materialId: string): Promise<MaterialLinkEntity[]> {
    return this.linkRepo.find({ where: { materialId } });
  }

  saveLink(entity: Partial<MaterialLinkEntity>): Promise<MaterialLinkEntity> {
    return this.linkRepo.save(this.linkRepo.create(entity));
  }
}
