import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createReadStream, statSync } from 'fs';
import { basename } from 'path';
import { Repository } from 'typeorm';
import { ChatAccessService } from '../../../common/access/chat-access.service';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import { STORAGE_NAMESPACE } from '../../../common/storage/storage.constants';
import { StorageService } from '../../../common/storage/storage.service';
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

/** Normalize browser MediaRecorder mime values for HTML media elements. */
export function normalizeChatAttachmentMime(
  mime: string | null | undefined,
  kind: ChatAttachmentKind | string,
  filename?: string | null,
): string {
  const raw = String(mime || '').trim().toLowerCase();
  const name = String(filename || '').toLowerCase();

  if (kind === ChatAttachmentKind.Voice || kind === 'voice') {
    if (
      raw.startsWith('audio/ogg') ||
      raw === 'audio/opus' ||
      name.endsWith('.ogg') ||
      name.endsWith('.opus')
    ) {
      return 'audio/ogg';
    }
    if (
      raw.startsWith('audio/mp4') ||
      raw.includes('aac') ||
      name.endsWith('.m4a') ||
      name.endsWith('.mp4')
    ) {
      return 'audio/mp4';
    }
    if (raw.startsWith('audio/webm') || name.endsWith('.webm')) {
      return 'audio/webm';
    }
    if (raw.startsWith('audio/')) return raw;
    return 'audio/webm';
  }

  if (raw) return raw;
  return 'application/octet-stream';
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
    private readonly storage: StorageService,
  ) {}

  async save(
    actor: DomainAccessActor,
    chatId: string,
    file: UploadedChatFile,
    kind: ChatAttachmentKind,
    durationMs?: number,
  ): Promise<ChatAttachmentUploadResult> {
    await this.access.assertCanWrite(actor, chatId);

    const stored = this.storage.saveBuffer(
      STORAGE_NAMESPACE.Chat,
      file.buffer,
      file.originalname || 'file',
    );
    // DB keeps bare filename for backward compatibility with existing rows.
    const storageKey = basename(stored.relativeKey);

    const messageType =
      kind === ChatAttachmentKind.Image
        ? ChatMessageType.Image
        : kind === ChatAttachmentKind.Voice
          ? ChatMessageType.Voice
          : ChatMessageType.File;

    const message = await this.messages.createTyped(actor, chatId, messageType, null, {
      broadcast: false,
    });
    const attachment = await this.attachmentRepo.save({
      messageId: message.id,
      kind,
      storageKey,
      mime: normalizeChatAttachmentMime(file.mimetype, kind, file.originalname),
      originalFilename: basename(file.originalname || storageKey),
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

  /**
   * Resolve a chat attachment for streaming/download.
   * Access is granted to any actor who can read the chat (membership / admin),
   * not only the uploader/owner of the file.
   */
  async resolveFile(
    actor: DomainAccessActor,
    attachmentId: string,
  ): Promise<ChatAttachmentFile> {
    const attachment = await this.attachmentRepo.findOne({
      where: { id: attachmentId },
      relations: { message: true },
    });
    if (!attachment?.message || attachment.message.deletedAt) {
      throw new NotFoundException('Вложение не найдено');
    }
    await this.access.assertCanRead(actor, attachment.message.chatId);

    const absolutePath = this.storage.requireExisting(
      `chat/${attachment.storageKey}`,
      `chat-attachment:${attachmentId}`,
    );
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
