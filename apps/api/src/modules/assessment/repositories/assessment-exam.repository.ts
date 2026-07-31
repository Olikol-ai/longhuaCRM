import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import {
  AssessmentExamEntity,
  AssessmentExamQuestionEntity,
  AssessmentRuleEntity,
  AssessmentSectionEntity,
} from '../entities';
import { ContentLifecycleStatus } from '../enums';

export type AssessmentExamStructure = {
  sections: AssessmentSectionEntity[];
  examQuestions: AssessmentExamQuestionEntity[];
};

@Injectable()
export class AssessmentExamRepository {
  constructor(
    @InjectRepository(AssessmentExamEntity)
    private readonly examRepo: Repository<AssessmentExamEntity>,
    @InjectRepository(AssessmentRuleEntity)
    private readonly ruleRepo: Repository<AssessmentRuleEntity>,
    @InjectRepository(AssessmentSectionEntity)
    private readonly sectionRepo: Repository<AssessmentSectionEntity>,
    @InjectRepository(AssessmentExamQuestionEntity)
    private readonly examQuestionRepo: Repository<AssessmentExamQuestionEntity>,
  ) {}

  findAll(): Promise<AssessmentExamEntity[]> {
    return this.examRepo.find({ order: { createdAt: 'DESC' } });
  }

  findById(id: string): Promise<AssessmentExamEntity | null> {
    return this.examRepo.findOne({ where: { id } });
  }

  filter(where: FindOptionsWhere<AssessmentExamEntity>): Promise<AssessmentExamEntity[]> {
    return this.examRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  filterByStatus(status: ContentLifecycleStatus): Promise<AssessmentExamEntity[]> {
    return this.filter({ status });
  }

  findWithStructure(examId: string): Promise<AssessmentExamEntity | null> {
    return this.examRepo.findOne({
      where: { id: examId },
      relations: [
        'rule',
        'sections',
        'examQuestions',
        'parts',
        'parts.poolItems',
        'parts.poolItems.question',
        'parts.poolItems.question.answers',
        'parts.poolItems.readingTask',
        'parts.poolItems.readingTask.questions',
        'parts.poolItems.readingTask.questions.answers',
        'parts.poolItems.readingTask.vocabulary',
        'parts.poolItems.listeningTask',
        'parts.poolItems.listeningTask.questions',
        'parts.poolItems.listeningTask.questions.answers',
        'parts.poolItems.listeningTask.vocabulary',
      ],
    });
  }

  save(entity: Partial<AssessmentExamEntity>): Promise<AssessmentExamEntity> {
    return this.examRepo.save(
      this.examRepo.create({ status: ContentLifecycleStatus.Draft, ...entity }),
    );
  }

  async update(
    id: string,
    data: Partial<AssessmentExamEntity>,
  ): Promise<AssessmentExamEntity | null> {
    await this.examRepo.update({ id }, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.examRepo.delete({ id });
  }

  saveRule(entity: Partial<AssessmentRuleEntity>): Promise<AssessmentRuleEntity> {
    return this.ruleRepo.save(this.ruleRepo.create(entity));
  }

  findRuleByExamId(examId: string): Promise<AssessmentRuleEntity | null> {
    return this.ruleRepo.findOne({ where: { examId } });
  }

  async replaceSectionsAndQuestions(
    examId: string,
    sections: Partial<AssessmentSectionEntity>[],
    examQuestions: Partial<AssessmentExamQuestionEntity>[],
  ): Promise<AssessmentExamStructure> {
    return this.examRepo.manager.transaction(async (manager) => {
      const sectionRepo = manager.getRepository(AssessmentSectionEntity);
      const examQuestionRepo = manager.getRepository(AssessmentExamQuestionEntity);

      await examQuestionRepo.delete({ examId });
      await sectionRepo.delete({ examId });

      const savedSections =
        sections.length === 0
          ? []
          : await sectionRepo.save(
              sections.map((section, index) =>
                sectionRepo.create({
                  examId,
                  sortOrder: section.sortOrder ?? index,
                  ...section,
                }),
              ),
            );

      const savedExamQuestions =
        examQuestions.length === 0
          ? []
          : await examQuestionRepo.save(
              examQuestions.map((question, index) =>
                examQuestionRepo.create({
                  examId,
                  sortOrder: question.sortOrder ?? index,
                  ...question,
                }),
              ),
            );

      return { sections: savedSections, examQuestions: savedExamQuestions };
    });
  }

  findSectionsByExamId(examId: string): Promise<AssessmentSectionEntity[]> {
    return this.sectionRepo.find({
      where: { examId },
      order: { sortOrder: 'ASC' },
    });
  }

  findExamQuestionsByExamId(examId: string): Promise<AssessmentExamQuestionEntity[]> {
    return this.examQuestionRepo.find({
      where: { examId },
      order: { sortOrder: 'ASC' },
    });
  }

  /** True when the live question is attached to at least one Exam (RESTRICT on delete). */
  async isQuestionUsedInExams(questionId: string): Promise<boolean> {
    const count = await this.examQuestionRepo.count({ where: { questionId } });
    return count > 0;
  }

  /** Replace exam questions only (sections must already exist). */
  async replaceExamQuestions(
    examId: string,
    examQuestions: Partial<AssessmentExamQuestionEntity>[],
  ): Promise<AssessmentExamQuestionEntity[]> {
    await this.examQuestionRepo.delete({ examId });
    if (examQuestions.length === 0) {
      return [];
    }
    return this.examQuestionRepo.save(
      examQuestions.map((question, index) =>
        this.examQuestionRepo.create({
          examId,
          sortOrder: question.sortOrder ?? index,
          ...question,
        }),
      ),
    );
  }
}
