import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'fs';
import { basename, join } from 'path';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { ChatAccessService } from '../../../common/access/chat-access.service';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import { ChatAttachmentEntity, ChatVoiceMessageEntity } from '../entities';
import { ChatAttachmentKind, ChatMessageType } from '../enums/chat.enums';
import { ChatMessagesService } from './chat-messages.service';

export interface UploadedChatFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
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
  ): Promise<ChatAttachmentEntity> {
    await this.access.assertCanWrite(actor, chatId);
    const directory = join(process.cwd(), 'uploads', 'chat');
    mkdirSync(directory, { recursive: true });
    const storageKey = `${randomUUID()}-${basename(file.originalname)}`;
    writeFileSync(join(directory, storageKey), file.buffer);

    const messageType =
      kind === ChatAttachmentKind.Image
        ? ChatMessageType.Image
        : kind === ChatAttachmentKind.Voice
          ? ChatMessageType.Voice
          : ChatMessageType.File;

    const message = await this.messages.createTyped(actor, chatId, messageType, null);
    const attachment = await this.attachmentRepo.save({
      messageId: message.id,
      kind,
      storageKey,
      mime: file.mimetype || null,
      originalFilename: basename(file.originalname),
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

    return attachment;
  }

  async download(
    actor: DomainAccessActor,
    attachmentId: string,
  ): Promise<{ attachment: ChatAttachmentEntity; stream: ReturnType<typeof createReadStream> }> {
    const attachment = await this.attachmentRepo.findOne({
      where: { id: attachmentId },
      relations: { message: true },
    });
    if (!attachment?.message) throw new NotFoundException('Attachment not found');
    await this.access.assertCanRead(actor, attachment.message.chatId);
    const filePath = join(process.cwd(), 'uploads', 'chat', attachment.storageKey);
    if (!existsSync(filePath)) throw new NotFoundException('Attachment file not found');
    return { attachment, stream: createReadStream(filePath) };
  }
}
