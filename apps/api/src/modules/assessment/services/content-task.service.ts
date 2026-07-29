import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AssessmentAccessService } from '../../../common/access/assessment-access.service';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import {
  AUTHORING_ATOMIC_QUESTION_TYPES,
  AttachmentKind,
  ContentLifecycleStatus,
  QuestionType,
} from '../enums';
import {
  AssessmentContentTaskEntity,
  AssessmentContentTaskQuestionEntity,
  AssessmentQuestionEntity,
} from '../entities';
import { ContentTaskType } from '../entities/assessment-content-task.entity';
import { AssessmentQuestionRepository } from '../repositories';

export type CreateContentTaskInput = {
  taskType: ContentTaskType;
  title: string;
  textContent?: string | null;
  audioAttachmentId?: string | null;
  questionIds?: string[];
};

export type UpdateContentTaskInput = {
  title?: string;
  textContent?: string | null;
  audioAttachmentId?: string | null;
  questionIds?: string[];
  status?: ContentLifecycleStatus;
};

@Injectable()
export class ContentTaskService {
  constructor(
    @InjectRepository(AssessmentContentTaskEntity)
    private readonly tasks: Repository<AssessmentContentTaskEntity>,
    @InjectRepository(AssessmentContentTaskQuestionEntity)
    private readonly links: Repository<AssessmentContentTaskQuestionEntity>,
    @InjectRepository(AssessmentQuestionEntity)
    private readonly questions: Repository<AssessmentQuestionEntity>,
    private readonly questionRepo: AssessmentQuestionRepository,
    private readonly access: AssessmentAccessService,
  ) {}

  async list(actor: DomainAccessActor, taskType?: ContentTaskType) {
    this.access.assertCanManageContent(actor);
    const where: Record<string, unknown> = this.access.isAdmin(actor)
      ? {}
      : { createdByUserId: actor.sub };
    if (taskType) where.taskType = taskType;
    const rows = await this.tasks.find({
      where,
      order: { updatedAt: 'DESC' },
      relations: ['questions', 'questions.question'],
    });
    return rows.map((row) => this.toDto(row));
  }

  async get(actor: DomainAccessActor, id: string) {
    const row = await this.requireOwned(actor, id);
    return this.toDto(row);
  }

  async create(actor: DomainAccessActor, input: CreateContentTaskInput) {
    this.access.assertCanManageContent(actor);
    if (!input.title?.trim()) {
      throw new BadRequestException('Укажите название задачи');
    }
    const task = await this.tasks.save(
      this.tasks.create({
        taskType: input.taskType,
        title: input.title.trim(),
        textContent: input.textContent?.trim() || null,
        audioAttachmentId: input.audioAttachmentId ?? null,
        status: ContentLifecycleStatus.Draft,
        createdByUserId: actor.sub,
      }),
    );
    if (input.questionIds?.length) {
      await this.replaceQuestions(actor, task.id, input.questionIds);
    }
    return this.get(actor, task.id);
  }

  async update(actor: DomainAccessActor, id: string, input: UpdateContentTaskInput) {
    const task = await this.requireOwned(actor, id);
    if (input.title !== undefined) task.title = input.title.trim();
    if (input.textContent !== undefined) {
      task.textContent = input.textContent?.trim() || null;
    }
    if (input.audioAttachmentId !== undefined) {
      task.audioAttachmentId = input.audioAttachmentId;
    }
    if (input.status !== undefined) {
      task.status = input.status;
    }
    await this.tasks.save(task);
    if (input.questionIds) {
      await this.replaceQuestions(actor, id, input.questionIds);
      await this.syncAudioToNestedQuestions(id);
    }
    return this.get(actor, id);
  }

  async publish(actor: DomainAccessActor, id: string) {
    const task = await this.requireOwned(actor, id);
    const count = await this.links.count({ where: { contentTaskId: id } });
    if (count < 1) {
      throw new BadRequestException('Добавьте хотя бы один вопрос в задачу');
    }
    this.validateTaskPayload(task.taskType, task);
    await this.syncAudioToNestedQuestions(id);
    task.status = ContentLifecycleStatus.Published;
    await this.tasks.save(task);
    return this.get(actor, id);
  }

  async remove(actor: DomainAccessActor, id: string) {
    await this.requireOwned(actor, id);
    await this.tasks.delete({ id });
    return { ok: true };
  }

  /**
   * Upload listening audio: creates a carrier question + attachment, stores attachment id on task,
   * and mirrors audio onto nested questions so attempts can play it.
   */
  async uploadAudio(
    actor: DomainAccessActor,
    id: string,
    input: {
      storageKey: string;
      mime?: string | null;
      originalFilename?: string | null;
    },
  ) {
    const task = await this.requireOwned(actor, id);
    if (task.taskType !== 'listening') {
      throw new BadRequestException('Аудио можно загрузить только для аудирования');
    }

    let carrierId: string | null = null;
    if (task.audioAttachmentId) {
      const existing = await this.questionRepo.findAttachmentById(task.audioAttachmentId);
      carrierId = existing?.questionId ?? null;
    }
    if (!carrierId) {
      const carrier = await this.questions.save(
        this.questions.create({
          type: QuestionType.ShortText,
          stem: `Аудио носитель: ${task.title}`,
          points: '0',
          difficulty: 1,
          explanation: null,
          status: ContentLifecycleStatus.Draft,
          createdByUserId: actor.sub,
        }),
      );
      carrierId = carrier.id;
    }

    const attachment = await this.questionRepo.saveAttachment({
      questionId: carrierId,
      kind: AttachmentKind.Audio,
      storageKey: input.storageKey,
      mime: input.mime ?? null,
      originalFilename: input.originalFilename ?? null,
      sortOrder: 0,
    });
    task.audioAttachmentId = attachment.id;
    await this.tasks.save(task);
    await this.syncAudioToNestedQuestions(id);
    return this.get(actor, id);
  }

  async loadPublishedWithQuestions(ids: string[]): Promise<AssessmentContentTaskEntity[]> {
    if (!ids.length) return [];
    return this.tasks.find({
      where: { id: In(ids), status: ContentLifecycleStatus.Published },
      relations: ['questions', 'questions.question', 'questions.question.answers'],
    });
  }

  private async replaceQuestions(
    actor: DomainAccessActor,
    taskId: string,
    questionIds: string[],
  ) {
    const unique = [...new Set(questionIds.filter(Boolean))];
    if (unique.length === 0) {
      await this.links.delete({ contentTaskId: taskId });
      return;
    }
    const qs = await this.questions.find({ where: { id: In(unique) } });
    if (qs.length !== unique.length) {
      throw new BadRequestException('Один или несколько вопросов не найдены');
    }
    for (const q of qs) {
      this.access.assertCanManageCreatedContent(actor, q, 'question');
      if (!AUTHORING_ATOMIC_QUESTION_TYPES.has(q.type as QuestionType)) {
        throw new BadRequestException(
          'В задачу можно добавлять только атомарные вопросы (тест/текст/перевод)',
        );
      }
    }
    await this.links.delete({ contentTaskId: taskId });
    await this.links.save(
      unique.map((questionId, index) =>
        this.links.create({
          contentTaskId: taskId,
          questionId,
          sortOrder: index,
        }),
      ),
    );
  }

  private async syncAudioToNestedQuestions(taskId: string) {
    const task = await this.tasks.findOne({
      where: { id: taskId },
      relations: ['questions'],
    });
    if (!task?.audioAttachmentId || task.taskType !== 'listening') return;
    const source = await this.questionRepo.findAttachmentById(task.audioAttachmentId);
    if (!source) return;
    for (const link of task.questions ?? []) {
      const existing = await this.questionRepo.findAttachmentsByQuestionId(link.questionId);
      const already = existing.some(
        (a) => a.kind === AttachmentKind.Audio && a.storageKey === source.storageKey,
      );
      if (already) continue;
      await this.questionRepo.saveAttachment({
        questionId: link.questionId,
        kind: AttachmentKind.Audio,
        storageKey: source.storageKey,
        mime: source.mime,
        originalFilename: source.originalFilename,
        sortOrder: existing.length,
      });
    }
  }

  private validateTaskPayload(
    taskType: ContentTaskType,
    input: { textContent?: string | null; audioAttachmentId?: string | null },
  ) {
    if (taskType === 'reading' && !String(input.textContent || '').trim()) {
      throw new BadRequestException('Для чтения нужен текст');
    }
    if (taskType === 'listening' && !input.audioAttachmentId) {
      throw new BadRequestException('Для аудирования нужен аудиофайл');
    }
  }

  private async requireOwned(actor: DomainAccessActor, id: string) {
    const row = await this.tasks.findOne({
      where: { id },
      relations: ['questions', 'questions.question', 'questions.question.answers'],
    });
    if (!row) throw new NotFoundException('Content task not found');
    this.access.assertCanManageCreatedContent(actor, row, 'content task');
    return row;
  }

  private toDto(row: AssessmentContentTaskEntity) {
    const links = [...(row.questions ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    return {
      id: row.id,
      task_type: row.taskType,
      title: row.title,
      text_content: row.textContent,
      audio_attachment_id: row.audioAttachmentId,
      status: row.status,
      created_by_user_id: row.createdByUserId,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      questions: links.map((link) => ({
        id: link.id,
        question_id: link.questionId,
        sort_order: link.sortOrder,
        question: link.question
          ? {
              id: link.question.id,
              type: link.question.type,
              stem: link.question.stem,
              points: link.question.points,
              status: link.question.status,
            }
          : null,
      })),
    };
  }
}
