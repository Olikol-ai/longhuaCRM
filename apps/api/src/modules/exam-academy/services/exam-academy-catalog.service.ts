import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CATALOG_STATUS, CONTENT_STATUS } from '../constants';
import {
  ExamAcademyItemTypeEntity,
  ExamAcademyLevelEntity,
  ExamAcademyMockBlueprintEntity,
  ExamAcademyProgramEntity,
  ExamAcademyProgramVersionEntity,
  ExamAcademySectionTemplateEntity,
} from '../entities';

@Injectable()
export class ExamAcademyCatalogService {
  constructor(
    @InjectRepository(ExamAcademyProgramEntity)
    private readonly programs: Repository<ExamAcademyProgramEntity>,
    @InjectRepository(ExamAcademyProgramVersionEntity)
    private readonly versions: Repository<ExamAcademyProgramVersionEntity>,
    @InjectRepository(ExamAcademyLevelEntity)
    private readonly levels: Repository<ExamAcademyLevelEntity>,
    @InjectRepository(ExamAcademySectionTemplateEntity)
    private readonly sections: Repository<ExamAcademySectionTemplateEntity>,
    @InjectRepository(ExamAcademyItemTypeEntity)
    private readonly itemTypes: Repository<ExamAcademyItemTypeEntity>,
    @InjectRepository(ExamAcademyMockBlueprintEntity)
    private readonly blueprints: Repository<ExamAcademyMockBlueprintEntity>,
  ) {}

  listPrograms() {
    return this.programs.find({
      where: { status: CATALOG_STATUS.Active },
      order: { code: 'ASC' },
    });
  }

  async listVersions(programCode?: string) {
    if (!programCode) {
      return this.versions.find({
        where: { status: CATALOG_STATUS.Active },
        order: { sortOrder: 'ASC' },
        relations: { program: true },
      });
    }
    const program = await this.programs.findOne({ where: { code: programCode } });
    if (!program) throw new NotFoundException('Program not found');
    return this.versions.find({
      where: { programId: program.id, status: CATALOG_STATUS.Active },
      order: { sortOrder: 'ASC' },
    });
  }

  async listLevels(versionCode: string) {
    const version = await this.versions.findOne({ where: { code: versionCode } });
    if (!version) throw new NotFoundException('Version not found');
    return this.levels.find({
      where: { versionId: version.id, status: CATALOG_STATUS.Active },
      order: { sortOrder: 'ASC' },
    });
  }

  async getLevelSections(levelId: string) {
    const level = await this.levels.findOne({ where: { id: levelId } });
    if (!level) throw new NotFoundException('Level not found');
    return this.sections.find({
      where: { levelId },
      order: { sortOrder: 'ASC' },
      relations: { itemTypes: true },
    });
  }

  listItemTypes() {
    return this.itemTypes.find({
      where: { status: CATALOG_STATUS.Active },
      order: { sortOrder: 'ASC' },
    });
  }

  async listBlueprints(levelId: string) {
    return this.blueprints.find({
      where: { levelId, status: CONTENT_STATUS.Published },
      order: { revision: 'DESC' },
      relations: { sections: true, scoringProfile: true },
    });
  }
}
