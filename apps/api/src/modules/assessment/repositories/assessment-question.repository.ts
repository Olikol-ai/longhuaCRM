import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import {
  AssessmentAnswerEntity,
  AssessmentQuestionAttachmentEntity,
  AssessmentQuestionEntity,
  AssessmentQuestionTopicEntity,
} from '../entities';
import { ContentLifecycleStatus } from '../enums';

@Injectable()
export class AssessmentQuestionRepository {
  constructor(
    @InjectRepository(AssessmentQuestionEntity)
    private readonly questionRepo: Repository<AssessmentQuestionEntity>,
    @InjectRepository(AssessmentAnswerEntity)
    private readonly answerRepo: Repository<AssessmentAnswerEntity>,
    @InjectRepository(AssessmentQuestionTopicEntity)
    private readonly questionTopicRepo: Repository<AssessmentQuestionTopicEntity>,
    @InjectRepository(AssessmentQuestionAttachmentEntity)
    private readonly attachmentRepo: Repository<AssessmentQuestionAttachmentEntity>,
  ) {}

  findAll(): Promise<AssessmentQuestionEntity[]> {
    return this.questionRepo.find({ order: { createdAt: 'DESC' } });
  }

  findById(id: string): Promise<AssessmentQuestionEntity | null> {
    return this.questionRepo.findOne({ where: { id } });
  }

  findByIdWithAnswers(id: string): Promise<AssessmentQuestionEntity | null> {
    return this.questionRepo.findOne({
      where: { id },
      relations: ['answers'],
    });
  }

  findByIdWithAnswersAndAttachments(
    id: string,
  ): Promise<AssessmentQuestionEntity | null> {
    return this.questionRepo.findOne({
      where: { id },
      relations: ['answers', 'attachments'],
    });
  }

  findByIdsWithAnswers(ids: string[]): Promise<AssessmentQuestionEntity[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.questionRepo
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.answers', 'answers')
      .where('q.id IN (:...ids)', { ids })
      .orderBy('answers.sort_order', 'ASC')
      .getMany();
  }

  findPublishedByBankId(bankId: string): Promise<AssessmentQuestionEntity[]> {
    return this.questionRepo.find({
      where: { bankId, status: ContentLifecycleStatus.Published },
      order: { createdAt: 'ASC' },
    });
  }

  filter(where: FindOptionsWhere<AssessmentQuestionEntity>): Promise<AssessmentQuestionEntity[]> {
    return this.questionRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  filterByBankId(bankId: string): Promise<AssessmentQuestionEntity[]> {
    return this.filter({ bankId });
  }

  filterByStatus(status: ContentLifecycleStatus): Promise<AssessmentQuestionEntity[]> {
    return this.filter({ status });
  }

  save(entity: Partial<AssessmentQuestionEntity>): Promise<AssessmentQuestionEntity> {
    return this.questionRepo.save(
      this.questionRepo.create({ status: ContentLifecycleStatus.Draft, ...entity }),
    );
  }

  async update(
    id: string,
    data: Partial<AssessmentQuestionEntity>,
  ): Promise<AssessmentQuestionEntity | null> {
    await this.questionRepo.update({ id }, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.questionRepo.delete({ id });
  }

  findAnswersByQuestionId(questionId: string): Promise<AssessmentAnswerEntity[]> {
    return this.answerRepo.find({
      where: { questionId },
      order: { sortOrder: 'ASC' },
    });
  }

  saveAnswer(entity: Partial<AssessmentAnswerEntity>): Promise<AssessmentAnswerEntity> {
    return this.answerRepo.save(this.answerRepo.create(entity));
  }

  async updateAnswer(
    id: string,
    data: Partial<AssessmentAnswerEntity>,
  ): Promise<AssessmentAnswerEntity | null> {
    await this.answerRepo.update({ id }, data);
    return this.answerRepo.findOne({ where: { id } });
  }

  async deleteAnswer(id: string): Promise<void> {
    await this.answerRepo.delete({ id });
  }

  async deleteAnswersByQuestionId(questionId: string): Promise<void> {
    await this.answerRepo.delete({ questionId });
  }

  findTopicsByQuestionId(questionId: string): Promise<AssessmentQuestionTopicEntity[]> {
    return this.questionTopicRepo.find({ where: { questionId } });
  }

  async setTopics(questionId: string, topicIds: string[]): Promise<AssessmentQuestionTopicEntity[]> {
    await this.questionTopicRepo.delete({ questionId });
    if (topicIds.length === 0) {
      return [];
    }
    const rows = topicIds.map((topicId) =>
      this.questionTopicRepo.create({ questionId, topicId }),
    );
    return this.questionTopicRepo.save(rows);
  }

  findAttachmentsByQuestionId(
    questionId: string,
  ): Promise<AssessmentQuestionAttachmentEntity[]> {
    return this.attachmentRepo.find({
      where: { questionId },
      order: { sortOrder: 'ASC' },
    });
  }

  findAttachmentById(id: string): Promise<AssessmentQuestionAttachmentEntity | null> {
    return this.attachmentRepo.findOne({ where: { id } });
  }

  saveAttachment(
    entity: Partial<AssessmentQuestionAttachmentEntity>,
  ): Promise<AssessmentQuestionAttachmentEntity> {
    return this.attachmentRepo.save(this.attachmentRepo.create(entity));
  }

  async deleteAttachment(id: string): Promise<void> {
    await this.attachmentRepo.delete({ id });
  }
}
