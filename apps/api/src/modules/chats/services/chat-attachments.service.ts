import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'fs';
import { basename, join } from 'path';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { ChatAccessService } from '../../../common/access/chat-access.service';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import {
  findExistingUpload,
  getUploadsRoot,
  uploadsJoin,
} from '../../../common/storage/uploads-root';
import { ChatAttachmentEntity, ChatMessageEntity, ChatVoiceMessageEntity } from '../entities';
import { ChatAttachmentKind, ChatMessageType } from '../enums/chat.enums';
import { ChatMessagesService } from './chat-messages.service';

export interface UploadedChatFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface ChatAttachmentUploadResult {
  attachment: ChatAttachmentEntity;
  message: ChatMessageEntity | null;
}

export interface ChatAttachmentFile {
  attachment: ChatAttachmentEntity;
  absolutePath: string;
  size: number;
}

@Injectable()
export class ChatAttachmentsService {
  constructor(
    @InjectRepository(ChatAttachmentEntity)
    private readonly attachmentRepo: Repository<ChatAttachmentEntity>,
    @InjectRepository(ChatVoiceMessageEntity)
    private readonly voiceRepo: Repository<ChatVoiceMessageEntity>,
    private readonly access: ChatAccessService,
    private readonly messages: ChatMessagesService,
  ) {}

  async save(
    actor: DomainAccessActor,
    chatId: string,
    file: UploadedChatFile,
    kind: ChatAttachmentKind,
    durationMs?: number,
  ): Promise<ChatAttachmentUploadResult> {
    await this.access.assertCanWrite(actor, chatId);
    const directory = uploadsJoin('chat');
    mkdirSync(directory, { recursive: true });
    const safeName = basename(file.originalname || 'file').replace(/[^\w.\-()+\u0400-\u04FF]+/g, '_');
    const storageKey = `${randomUUID()}-${safeName || 'file'}`;
    writeFileSync(join(directory, storageKey), file.buffer);

    const messageType =
      kind === ChatAttachmentKind.Image
        ? ChatMessageType.Image
        : kind === ChatAttachmentKind.Voice
          ? ChatMessageType.Voice
          : ChatMessageType.File;

    // Persist message first without WS broadcast; emit only after attachment row exists.
    const message = await this.messages.createTyped(actor, chatId, messageType, null, {
      broadcast: false,
    });
    const attachment = await this.attachmentRepo.save({
      messageId: message.id,
      kind,
      storageKey,
      mime: file.mimetype || null,
      originalFilename: basename(file.originalname || safeName),
      sizeBytes: String(file.size),
      durationMs: durationMs ?? null,
      sortOrder: 0,
    });

    if (kind === ChatAttachmentKind.Voice) {
      await this.voiceRepo.save({
        attachmentId: attachment.id,
        durationMs: durationMs ?? 0,
      });
    }

    const hydrated = await this.messages.getHydrated(message.id);
    if (hydrated) {
      await this.messages.broadcastCreated(hydrated);
    }

    return {
      attachment,
      message: hydrated,
    };
  }

  async resolveFile(
    actor: DomainAccessActor,
    attachmentId: string,
  ): Promise<ChatAttachmentFile> {
    const attachment = await this.attachmentRepo.findOne({
      where: { id: attachmentId },
      relations: { message: true },
    });
    if (!attachment?.message) {
      throw new NotFoundException('Вложение не найдено');
    }
    await this.access.assertCanRead(actor, attachment.message.chatId);

    const primary = join(getUploadsRoot(), 'chat', attachment.storageKey);
    const absolutePath =
      (existsSync(primary) ? primary : null) ||
      findExistingUpload(`chat/${attachment.storageKey}`) ||
      findExistingUpload(attachment.storageKey);

    if (!absolutePath || !existsSync(absolutePath)) {
      throw new NotFoundException('Файл был удалён или недоступен.');
    }

    const size = statSync(absolutePath).size;
    return { attachment, absolutePath, size };
  }

  /** @deprecated Prefer resolveFile + Range-aware streaming in the controller. */
  async download(
    actor: DomainAccessActor,
    attachmentId: string,
  ): Promise<{ attachment: ChatAttachmentEntity; stream: ReturnType<typeof createReadStream> }> {
    const file = await this.resolveFile(actor, attachmentId);
    return {
      attachment: file.attachment,
      stream: createReadStream(file.absolutePath),
    };
  }
}
