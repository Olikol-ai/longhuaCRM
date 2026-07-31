import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssessmentAccessService } from '../../../common/access/assessment-access.service';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import {
  AUTHORING_ATOMIC_QUESTION_TYPES,
  ContentLifecycleStatus,
  QuestionType,
} from '../enums';
import {
  AssessmentReadingQuestionAnswerEntity,
  AssessmentReadingQuestionEntity,
  AssessmentReadingTaskEntity,
  AssessmentReadingTaskVocabularyEntity,
} from '../entities';
import {
  mapVocabularyDto,
  normalizeVocabularyInput,
  VocabularyItemInput,
} from './task-vocabulary.util';

export type NestedQuestionInput = {
  type: QuestionType;
  stem: string;
  points?: number | string;
  explanation?: string | null;
  answers?: Array<{ text: string; isCorrect: boolean; sortOrder?: number }>;
};

export type CreateReadingTaskInput = {
  title: string;
  textContent: string;
  instructions?: string | null;
  levelLabel?: string | null;
  vocabulary?: VocabularyItemInput[];
  questions?: NestedQuestionInput[];
};

export type UpdateReadingTaskInput = {
  title?: string;
  textContent?: string;
  instructions?: string | null;
  levelLabel?: string | null;
  vocabulary?: VocabularyItemInput[];
  questions?: NestedQuestionInput[];
  status?: ContentLifecycleStatus;
};

const TASK_RELATIONS = ['questions', 'questions.answers', 'vocabulary'] as const;

@Injectable()
export class ReadingTaskService {
  constructor(
    @InjectRepository(AssessmentReadingTaskEntity)
    private readonly tasks: Repository<AssessmentReadingTaskEntity>,
    @InjectRepository(AssessmentReadingQuestionEntity)
    private readonly questions: Repository<AssessmentReadingQuestionEntity>,
    @InjectRepository(AssessmentReadingQuestionAnswerEntity)
    private readonly answers: Repository<AssessmentReadingQuestionAnswerEntity>,
    @InjectRepository(AssessmentReadingTaskVocabularyEntity)
    private readonly vocabulary: Repository<AssessmentReadingTaskVocabularyEntity>,
    private readonly access: AssessmentAccessService,
  ) {}

  async list(actor: DomainAccessActor) {
    this.access.assertCanManageContent(actor);
    const where = this.access.isAdmin(actor) ? {} : { createdByUserId: actor.sub };
    const rows = await this.tasks.find({
      where,
      order: { updatedAt: 'DESC' },
      relations: [...TASK_RELATIONS],
    });
    return rows.map((row) => this.toDto(row));
  }

  async get(actor: DomainAccessActor, id: string) {
    return this.toDto(await this.requireOwned(actor, id));
  }

  async create(actor: DomainAccessActor, input: CreateReadingTaskInput) {
    this.access.assertCanManageContent(actor);
    if (!input.title?.trim()) throw new BadRequestException('Укажите название');
    if (!input.textContent?.trim()) throw new BadRequestException('Укажите текст чтения');
    const task = await this.tasks.save(
      this.tasks.create({
        title: input.title.trim(),
        textContent: input.textContent.trim(),
        instructions: input.instructions?.trim() || null,
        levelLabel: input.levelLabel?.trim() || null,
        status: ContentLifecycleStatus.Draft,
        createdByUserId: actor.sub,
      }),
    );
    if (input.vocabulary) await this.replaceVocabulary(task.id, input.vocabulary);
    if (input.questions?.length) {
      await this.replaceQuestions(task.id, input.questions);
    }
    return this.get(actor, task.id);
  }

  async update(actor: DomainAccessActor, id: string, input: UpdateReadingTaskInput) {
    const task = await this.requireOwned(actor, id);
    if (input.title !== undefined) task.title = input.title.trim();
    if (input.textContent !== undefined) task.textContent = input.textContent.trim();
    if (input.instructions !== undefined) {
      task.instructions = input.instructions?.trim() || null;
    }
    if (input.levelLabel !== undefined) {
      task.levelLabel = input.levelLabel?.trim() || null;
    }
    if (input.status !== undefined) task.status = input.status;
    await this.tasks.save(task);
    if (input.vocabulary) await this.replaceVocabulary(id, input.vocabulary);
    if (input.questions) await this.replaceQuestions(id, input.questions);
    return this.get(actor, id);
  }

  async publish(actor: DomainAccessActor, id: string) {
    const task = await this.requireOwned(actor, id);
    if (!task.textContent?.trim()) {
      throw new BadRequestException('Укажите текст чтения перед публикацией');
    }
    const count = await this.questions.count({ where: { readingTaskId: id } });
    if (count < 1) throw new BadRequestException('Добавьте хотя бы один вопрос');
    task.status = ContentLifecycleStatus.Published;
    await this.tasks.save(task);
    return this.get(actor, id);
  }

  async remove(actor: DomainAccessActor, id: string) {
    const task = await this.requireOwned(actor, id);
    await this.tasks.remove(task);
  }

  async loadPublishedWithQuestions(ids: string[]): Promise<AssessmentReadingTaskEntity[]> {
    if (!ids.length) return [];
    return this.tasks.find({
      where: ids.map((id) => ({ id, status: ContentLifecycleStatus.Published })),
      relations: [...TASK_RELATIONS],
    });
  }

  private async replaceVocabulary(taskId: string, items: VocabularyItemInput[]) {
    await this.vocabulary.delete({ readingTaskId: taskId });
    const normalized = normalizeVocabularyInput(items);
    if (!normalized.length) return;
    await this.vocabulary.save(
      normalized.map((row) =>
        this.vocabulary.create({
          readingTaskId: taskId,
          word: row.word,
          pinyin: row.pinyin,
          translation: row.translation,
          explanation: row.explanation,
          sortOrder: row.sortOrder,
        }),
      ),
    );
  }

  private async replaceQuestions(taskId: string, items: NestedQuestionInput[]) {
    await this.questions.delete({ readingTaskId: taskId });
    for (const [index, item] of items.entries()) {
      this.assertNestedQuestion(item, index);
      const question = await this.questions.save(
        this.questions.create({
          readingTaskId: taskId,
          sortOrder: index,
          type: item.type,
          stem: item.stem.trim(),
          points: String(item.points ?? 1),
          explanation: item.explanation?.trim() || null,
          status: ContentLifecycleStatus.Draft,
        }),
      );
      const answers = item.answers ?? [];
      if (answers.length) {
        await this.answers.save(
          answers.map((a, sortOrder) =>
            this.answers.create({
              readingQuestionId: question.id,
              text: a.text.trim(),
              isCorrect: Boolean(a.isCorrect),
              sortOrder: a.sortOrder ?? sortOrder,
            }),
          ),
        );
      }
    }
  }

  private assertNestedQuestion(item: NestedQuestionInput, index: number) {
    if (!AUTHORING_ATOMIC_QUESTION_TYPES.has(item.type)) {
      throw new BadRequestException(
        `Вопрос #${index + 1}: допустимы только тестовые типы (выбор/текст/перевод)`,
      );
    }
    if (!item.stem?.trim()) {
      throw new BadRequestException(`Вопрос #${index + 1}: укажите формулировку`);
    }
  }

  private async requireOwned(actor: DomainAccessActor, id: string) {
    const row = await this.tasks.findOne({
      where: { id },
      relations: [...TASK_RELATIONS],
    });
    if (!row) throw new NotFoundException('Reading task not found');
    this.access.assertCanManageCreatedContent(actor, row, 'reading task');
    return row;
  }

  private toDto(row: AssessmentReadingTaskEntity) {
    const questions = [...(row.questions ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    return {
      id: row.id,
      title: row.title,
      text_content: row.textContent,
      instructions: row.instructions,
      level_label: row.levelLabel,
      status: row.status,
      created_by_user_id: row.createdByUserId,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      vocabulary: mapVocabularyDto(row.vocabulary),
      questions: questions.map((q) => ({
        id: q.id,
        sort_order: q.sortOrder,
        type: q.type,
        stem: q.stem,
        points: Number(q.points),
        explanation: q.explanation,
        status: q.status,
        answers: [...(q.answers ?? [])]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((a) => ({
            id: a.id,
            text: a.text,
            is_correct: a.isCorrect,
            sort_order: a.sortOrder,
          })),
      })),
    };
  }
}
