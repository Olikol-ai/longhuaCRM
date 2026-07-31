import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'fs';
import { basename, extname, join } from 'path';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { AssessmentAccessService } from '../../../common/access/assessment-access.service';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import {
  AUTHORING_ATOMIC_QUESTION_TYPES,
  ContentLifecycleStatus,
  QuestionType,
} from '../enums';
import {
  AssessmentListeningQuestionAnswerEntity,
  AssessmentListeningQuestionEntity,
  AssessmentListeningTaskEntity,
} from '../entities';
import { NestedQuestionInput } from './reading-task.service';
import { uploadsJoin } from '../../../common/storage/uploads-root';

const AUDIO_DIR = uploadsJoin('assessment');
const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.ogg',
  '.wav',
  '.m4a',
  '.webm',
  '.aac',
  '.opus',
]);

export type CreateListeningTaskInput = {
  title: string;
  instructions?: string | null;
  levelLabel?: string | null;
  questions?: NestedQuestionInput[];
};

export type UpdateListeningTaskInput = {
  title?: string;
  instructions?: string | null;
  levelLabel?: string | null;
  questions?: NestedQuestionInput[];
  status?: ContentLifecycleStatus;
};

export type UploadedAudio = {
  buffer: Buffer;
  originalname: string;
  mimetype?: string;
  size: number;
};

@Injectable()
export class ListeningTaskService {
  constructor(
    @InjectRepository(AssessmentListeningTaskEntity)
    private readonly tasks: Repository<AssessmentListeningTaskEntity>,
    @InjectRepository(AssessmentListeningQuestionEntity)
    private readonly questions: Repository<AssessmentListeningQuestionEntity>,
    @InjectRepository(AssessmentListeningQuestionAnswerEntity)
    private readonly answers: Repository<AssessmentListeningQuestionAnswerEntity>,
    private readonly access: AssessmentAccessService,
  ) {}

  async list(actor: DomainAccessActor) {
    this.access.assertCanManageContent(actor);
    const where = this.access.isAdmin(actor) ? {} : { createdByUserId: actor.sub };
    const rows = await this.tasks.find({
      where,
      order: { updatedAt: 'DESC' },
      relations: ['questions', 'questions.answers'],
    });
    return rows.map((row) => this.toDto(row));
  }

  async get(actor: DomainAccessActor, id: string) {
    return this.toDto(await this.requireOwned(actor, id));
  }

  async create(actor: DomainAccessActor, input: CreateListeningTaskInput) {
    this.access.assertCanManageContent(actor);
    if (!input.title?.trim()) throw new BadRequestException('Укажите название');
    const task = await this.tasks.save(
      this.tasks.create({
        title: input.title.trim(),
        instructions: input.instructions?.trim() || null,
        levelLabel: input.levelLabel?.trim() || null,
        audioStorageKey: null,
        audioMime: null,
        audioOriginalFilename: null,
        status: ContentLifecycleStatus.Draft,
        createdByUserId: actor.sub,
      }),
    );
    if (input.questions?.length) await this.replaceQuestions(task.id, input.questions);
    return this.get(actor, task.id);
  }

  async update(actor: DomainAccessActor, id: string, input: UpdateListeningTaskInput) {
    const task = await this.requireOwned(actor, id);
    if (input.title !== undefined) task.title = input.title.trim();
    if (input.instructions !== undefined) {
      task.instructions = input.instructions?.trim() || null;
    }
    if (input.levelLabel !== undefined) {
      task.levelLabel = input.levelLabel?.trim() || null;
    }
    if (input.status !== undefined) task.status = input.status;
    await this.tasks.save(task);
    if (input.questions) await this.replaceQuestions(id, input.questions);
    return this.get(actor, id);
  }

  async uploadAudio(actor: DomainAccessActor, id: string, file: UploadedAudio) {
    const task = await this.requireOwned(actor, id);
    if (!file?.buffer?.length) throw new BadRequestException('Audio file is required');
    const extension = extname(file.originalname || '').toLowerCase();
    if (!AUDIO_EXTENSIONS.has(extension)) {
      throw new BadRequestException('Поддерживаются аудиофайлы: mp3, ogg, wav, m4a, webm, aac');
    }
    mkdirSync(AUDIO_DIR, { recursive: true });
    const storageKey = `${randomUUID()}${extension}`;
    writeFileSync(join(AUDIO_DIR, storageKey), file.buffer);
    task.audioStorageKey = storageKey;
    task.audioMime = file.mimetype || null;
    task.audioOriginalFilename = basename(file.originalname || storageKey);
    await this.tasks.save(task);
    return this.get(actor, id);
  }

  async streamAudio(actor: DomainAccessActor, id: string): Promise<StreamableFile> {
    const task = await this.requireOwned(actor, id);
    if (!task.audioStorageKey) throw new NotFoundException('Audio not found');
    const path = join(AUDIO_DIR, basename(task.audioStorageKey));
    if (!existsSync(path)) throw new NotFoundException('Audio file missing on disk');
    return new StreamableFile(createReadStream(path), {
      type: task.audioMime ?? 'audio/mpeg',
      disposition: `inline; filename="${task.audioOriginalFilename ?? task.audioStorageKey}"`,
    });
  }

  /** Student/attempt access: published tasks only (or admin/author). */
  async streamAudioForAttempt(actor: DomainAccessActor, id: string): Promise<StreamableFile> {
    const task = await this.tasks.findOne({ where: { id } });
    if (!task?.audioStorageKey) throw new NotFoundException('Audio not found');
    if (task.status !== ContentLifecycleStatus.Published && !this.access.isAdmin(actor)) {
      this.access.assertCanManageCreatedContent(actor, task, 'listening task');
    }
    const path = join(AUDIO_DIR, basename(task.audioStorageKey));
    if (!existsSync(path)) throw new NotFoundException('Audio file missing on disk');
    return new StreamableFile(createReadStream(path), {
      type: task.audioMime ?? 'audio/mpeg',
      disposition: `inline; filename="${task.audioOriginalFilename ?? task.audioStorageKey}"`,
    });
  }

  async publish(actor: DomainAccessActor, id: string) {
    const task = await this.requireOwned(actor, id);
    if (!task.audioStorageKey) {
      throw new BadRequestException('Загрузите аудио перед публикацией');
    }
    const count = await this.questions.count({ where: { listeningTaskId: id } });
    if (count < 1) throw new BadRequestException('Добавьте хотя бы один вопрос');
    task.status = ContentLifecycleStatus.Published;
    await this.tasks.save(task);
    return this.get(actor, id);
  }

  async remove(actor: DomainAccessActor, id: string) {
    const task = await this.requireOwned(actor, id);
    await this.tasks.remove(task);
  }

  async loadPublishedWithQuestions(ids: string[]): Promise<AssessmentListeningTaskEntity[]> {
    if (!ids.length) return [];
    return this.tasks.find({
      where: ids.map((id) => ({ id, status: ContentLifecycleStatus.Published })),
      relations: ['questions', 'questions.answers'],
    });
  }

  private async replaceQuestions(taskId: string, items: NestedQuestionInput[]) {
    await this.questions.delete({ listeningTaskId: taskId });
    for (const [index, item] of items.entries()) {
      if (!AUTHORING_ATOMIC_QUESTION_TYPES.has(item.type)) {
        throw new BadRequestException(
          `Вопрос #${index + 1}: допустимы только тестовые типы (выбор/текст/перевод)`,
        );
      }
      if (!item.stem?.trim()) {
        throw new BadRequestException(`Вопрос #${index + 1}: укажите формулировку`);
      }
      const question = await this.questions.save(
        this.questions.create({
          listeningTaskId: taskId,
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
              listeningQuestionId: question.id,
              text: a.text.trim(),
              isCorrect: Boolean(a.isCorrect),
              sortOrder: a.sortOrder ?? sortOrder,
            }),
          ),
        );
      }
    }
  }

  private async requireOwned(actor: DomainAccessActor, id: string) {
    const row = await this.tasks.findOne({
      where: { id },
      relations: ['questions', 'questions.answers'],
    });
    if (!row) throw new NotFoundException('Listening task not found');
    this.access.assertCanManageCreatedContent(actor, row, 'listening task');
    return row;
  }

  private toDto(row: AssessmentListeningTaskEntity) {
    const questions = [...(row.questions ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    return {
      id: row.id,
      title: row.title,
      instructions: row.instructions,
      level_label: row.levelLabel,
      has_audio: Boolean(row.audioStorageKey),
      audio_mime: row.audioMime,
      audio_original_filename: row.audioOriginalFilename,
      status: row.status,
      created_by_user_id: row.createdByUserId,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
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
