import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { MaterialsDomainAccessService } from '../../common/access/materials-domain-access.service';
import { normalizeRole } from '../../common/constants/roles';
import { JwtPayload } from '../auth/auth.service';
import { MaterialEntity } from './entities/material.entity';
import { MaterialFolderEntity } from './entities/material-folder.entity';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateMaterialFolderDto } from './dto/create-material-folder.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { UpdateMaterialFolderDto } from './dto/update-material-folder.dto';
import { MaterialAccessService } from './material-access.service';
import { MaterialsRepository } from './materials.repository';

export type MaterialDeleteResult = {
  success: true;
  mode: 'soft' | 'hard';
  message: string;
};

@Injectable()
export class MaterialsService {
  constructor(
    private readonly repository: MaterialsRepository,
    private readonly materialsAccess: MaterialsDomainAccessService,
    private readonly materialAccessService: MaterialAccessService,
  ) {}

  async findAllMaterials(actor: JwtPayload): Promise<MaterialEntity[]> {
    const where = await this.materialsAccess.scopeMaterialFilter(actor, {});
    const rows = await this.repository.filterMaterials(where as FindOptionsWhere<MaterialEntity>);
    const withCourse = await this.attachCourseIds(rows);
    return this.attachAccessSources(actor, withCourse);
  }

  async findMaterialById(actor: JwtPayload, id: string): Promise<MaterialEntity> {
    await this.materialsAccess.assertCanReadMaterial(actor, id);
    const row = await this.repository.findMaterialById(id);
    if (!row || row.status === 'deleted') {
      throw new NotFoundException('Material not found');
    }
    const [enriched] = await this.attachAccessSources(
      actor,
      await this.attachCourseIds([row]),
    );
    return enriched;
  }

  async createMaterial(actor: JwtPayload, dto: CreateMaterialDto): Promise<MaterialEntity> {
    const created = await this.repository.saveMaterial({
      ...dto,
      createdByUserId: actor.sub,
    });
    const grantedByRole =
      normalizeRole(actor.role) === 'admin'
        ? 'ADMIN'
        : normalizeRole(actor.role) === 'tutor'
          ? 'TUTOR'
          : 'TEACHER';
    await this.materialAccessService.grantPersonalAccess(
      actor.sub,
      [created.id],
      grantedByRole,
    );
    return created;
  }

  async updateMaterial(
    actor: JwtPayload,
    id: string,
    dto: UpdateMaterialDto,
  ): Promise<MaterialEntity> {
    const existing = await this.repository.findMaterialById(id);
    if (!existing || existing.status === 'deleted') {
      throw new NotFoundException('Material not found');
    }
    this.assertCanManageMaterial(actor, existing);

    if (dto.folderId) {
      const folder = await this.repository.findFolderById(dto.folderId);
      if (!folder) {
        throw new NotFoundException('Material folder not found');
      }
    }

    const row = await this.repository.updateMaterial(id, dto);
    if (!row) {
      throw new NotFoundException('Material not found');
    }
    return this.attachAccessSources(actor, await this.attachCourseIds([row])).then(
      (list) => list[0],
    );
  }

  /**
   * History-safe delete:
   * - with lesson links / access grants → soft-delete (status=deleted), keep links, revoke access
   * - unused material → hard delete after clearing access
   */
  async deleteMaterial(actor: JwtPayload, id: string): Promise<MaterialDeleteResult> {
    const row = await this.repository.findMaterialById(id);
    if (!row) {
      throw new NotFoundException('Материал не найден');
    }
    this.assertCanManageMaterial(actor, row);
    if (row.status === 'deleted') {
      return {
        success: true,
        mode: 'soft',
        message: 'Материал уже удалён. Привязки к урокам сохранены.',
      };
    }

    try {
      const linkCount = await this.repository.countLinksByMaterialId(id);
      const accessCount = await this.repository.countAccessByMaterialId(id);
      const keepHistory = linkCount > 0 || accessCount > 0;

      await this.repository.revokeAllAccessForMaterial(id);

      if (keepHistory) {
        await this.repository.updateMaterial(id, { status: 'deleted' });
        return {
          success: true,
          mode: 'soft',
          message:
            linkCount > 0
              ? 'Материал скрыт (удалён). Связи с уроками сохранены в истории.'
              : 'Материал скрыт (удалён). История доступа сохранена.',
        };
      }

      await this.repository.deleteAccessByMaterialId(id);
      await this.repository.deleteMaterial(id);
      return {
        success: true,
        mode: 'hard',
        message: 'Материал удалён.',
      };
    } catch (error) {
      const pgCode = (error as { code?: string })?.code;
      const detail = (error as Error)?.message ?? '';
      if (pgCode === '23503' || /foreign key|restrict/i.test(detail)) {
        await this.repository.revokeAllAccessForMaterial(id);
        await this.repository.updateMaterial(id, { status: 'deleted' });
        return {
          success: true,
          mode: 'soft',
          message:
            'Материал скрыт (удалён). Связанные записи сохранены — удаление истории невозможно.',
        };
      }
      throw new BadRequestException(
        'Не удалось удалить материал. Проверьте привязки к урокам и попробуйте снова.',
      );
    }
  }

  async filterMaterials(
    actor: JwtPayload,
    where: Record<string, unknown>,
  ): Promise<MaterialEntity[]> {
    const scoped = await this.materialsAccess.scopeMaterialFilter(actor, where);
    const rows = await this.repository.filterMaterials(scoped as FindOptionsWhere<MaterialEntity>);
    return this.attachAccessSources(actor, await this.attachCourseIds(rows));
  }

  private async attachCourseIds(materials: MaterialEntity[]): Promise<MaterialEntity[]> {
    if (materials.length === 0) {
      return materials;
    }

    const folderIds = [...new Set(materials.map((row) => row.folderId))];
    const folders = await this.repository.findFoldersByIds(folderIds);
    const courseByFolder = new Map(folders.map((folder) => [folder.id, folder.courseTemplateId]));

    return materials.map((material) => {
      const plain = {
        id: material.id,
        folderId: material.folderId,
        title: material.title,
        fileUrl: material.fileUrl,
        fileType: material.fileType,
        description: material.description,
        status: material.status,
        createdByUserId: material.createdByUserId ?? null,
        createdAt: material.createdAt,
        updatedAt: material.updatedAt,
        courseId: courseByFolder.get(material.folderId) ?? null,
      };
      return plain as unknown as MaterialEntity;
    });
  }

  private assertCanManageMaterial(actor: JwtPayload, material: MaterialEntity): void {
    if (this.materialsAccess.isAdmin(actor)) {
      return;
    }
    const role = normalizeRole(actor.role);
    if (role !== 'teacher' && role !== 'tutor') {
      throw new ForbiddenException('Недостаточно прав для изменения материала');
    }
    if (material.createdByUserId !== actor.sub) {
      throw new ForbiddenException('Можно изменять только свои материалы');
    }
  }

  private async attachAccessSources(
    actor: JwtPayload,
    materials: MaterialEntity[],
  ): Promise<MaterialEntity[]> {
    if (materials.length === 0 || this.materialsAccess.isAdmin(actor)) {
      return materials.map((material) => {
        const plain = {
          ...(material as MaterialEntity & { courseId?: string | null }),
          accessSources: [] as Array<{ type: string; label: string }>,
        };
        return plain as unknown as MaterialEntity;
      });
    }

    const sourceMap = await this.materialsAccess.resolveAccessSources(
      actor,
      materials.map((row) => row.id),
    );

    return materials.map((material) => {
      const plain = {
        ...(material as MaterialEntity & { courseId?: string | null }),
        accessSources: sourceMap[material.id] ?? [],
      };
      return plain as unknown as MaterialEntity;
    });
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
    if (!this.materialsAccess.isAdmin(actor)) {
      const folders = await this.findAllFolders(actor);
      if (!folders.some((folder) => folder.id === id)) {
        throw new NotFoundException('Material folder not found');
      }
    }
    return row;
  }

  async createFolder(
    actor: JwtPayload,
    dto: CreateMaterialFolderDto,
  ): Promise<MaterialFolderEntity> {
    const role = normalizeRole(actor.role);
    if (role === 'tutor') {
      if (dto.courseTemplateId) {
        throw new ForbiddenException(
          'Репетитор не может создавать папки курсов школы',
        );
      }
      return this.repository.saveFolder({
        ...dto,
        courseTemplateId: null,
        createdByUserId: actor.sub,
      });
    }
    return this.repository.saveFolder({
      ...dto,
      createdByUserId: actor.sub,
    });
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
}
