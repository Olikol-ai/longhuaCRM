import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import {
  ExamContentItemTypeEntity,
  ExamContentLevelEntity,
  ExamContentProgramEntity,
  ExamContentProgramVersionEntity,
  ExamContentSectionEntity,
  ExamContentTopicEntity,
} from '../entities';
import { ExamContentAccessService } from './exam-content-access.service';

@Injectable()
export class ExamContentTaxonomyService {
  constructor(
    @InjectRepository(ExamContentProgramEntity)
    private readonly programs: Repository<ExamContentProgramEntity>,
    @InjectRepository(ExamContentProgramVersionEntity)
    private readonly versions: Repository<ExamContentProgramVersionEntity>,
    @InjectRepository(ExamContentLevelEntity)
    private readonly levels: Repository<ExamContentLevelEntity>,
    @InjectRepository(ExamContentSectionEntity)
    private readonly sections: Repository<ExamContentSectionEntity>,
    @InjectRepository(ExamContentTopicEntity)
    private readonly topics: Repository<ExamContentTopicEntity>,
    @InjectRepository(ExamContentItemTypeEntity)
    private readonly itemTypes: Repository<ExamContentItemTypeEntity>,
    private readonly access: ExamContentAccessService,
  ) {}

  listPrograms() {
    return this.programs.find({ order: { code: 'ASC' } });
  }

  async listVersions(programCode?: string) {
    if (!programCode) {
      return this.versions.find({ order: { sortOrder: 'ASC' } });
    }
    const program = await this.programs.findOne({ where: { code: programCode } });
    if (!program) throw new NotFoundException('Program not found');
    return this.versions.find({
      where: { programId: program.id },
      order: { sortOrder: 'ASC' },
    });
  }

  async listLevels(versionCode: string) {
    const version = await this.versions.findOne({ where: { code: versionCode } });
    if (!version) throw new NotFoundException('Version not found');
    return this.levels.find({
      where: { versionId: version.id },
      order: { sortOrder: 'ASC' },
    });
  }

  async listSections(levelId: string) {
    return this.sections.find({
      where: { levelId },
      order: { sortOrder: 'ASC' },
    });
  }

  async listTopics(versionId: string) {
    return this.topics.find({
      where: { versionId },
      order: { sortOrder: 'ASC' },
      relations: { subtopics: true },
    });
  }

  listItemTypes() {
    return this.itemTypes.find({
      where: { status: 'active' },
      order: { sortOrder: 'ASC' },
    });
  }

  async createItemType(
    actor: DomainAccessActor,
    input: {
      code: string;
      title: string;
      engineAdapter: string;
      engineQuestionType?: string;
      answerShape: string;
      rendererKey: string;
      editorKey?: string;
    },
  ) {
    if (!this.access.isAdmin(actor)) {
      this.access.assertStaff(actor);
    }
    return this.itemTypes.save({
      code: input.code,
      title: input.title,
      engineAdapter: input.engineAdapter,
      engineQuestionType: input.engineQuestionType ?? null,
      answerShape: input.answerShape,
      supportsAutoGrade: true,
      rendererKey: input.rendererKey,
      editorKey: input.editorKey || input.code,
      previewKey: input.rendererKey,
      status: 'active',
      sortOrder: 100,
    });
  }
}
