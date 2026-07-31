import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  ChatAttachmentsService,
  normalizeChatAttachmentMime,
} from './services/chat-attachments.service';
import { ChatAttachmentKind } from './enums/chat.enums';
import { resetUploadsRootCache } from '../../common/storage/uploads-root';
import { StorageService } from '../../common/storage/storage.service';

describe('normalizeChatAttachmentMime', () => {
  it('maps voice recorder formats to playable audio types', () => {
    expect(
      normalizeChatAttachmentMime('audio/webm;codecs=opus', ChatAttachmentKind.Voice, 'a.webm'),
    ).toBe('audio/webm');
    expect(
      normalizeChatAttachmentMime('audio/ogg;codecs=opus', ChatAttachmentKind.Voice, 'a.ogg'),
    ).toBe('audio/ogg');
    expect(normalizeChatAttachmentMime('audio/opus', ChatAttachmentKind.Voice, 'a.opus')).toBe(
      'audio/ogg',
    );
    expect(normalizeChatAttachmentMime('audio/mp4', ChatAttachmentKind.Voice, 'a.m4a')).toBe(
      'audio/mp4',
    );
  });
});

describe('ChatAttachmentsService.resolveFile ACL', () => {
  const root = join(tmpdir(), `longhua-chat-att-${Date.now()}`);
  const storageKey = 'acl-test-voice.webm';
  let storage: StorageService;

  beforeAll(() => {
    process.env.UPLOADS_DIR = root;
    resetUploadsRootCache();
    mkdirSync(join(root, 'chat'), { recursive: true });
    writeFileSync(join(root, 'chat', storageKey), Buffer.from('fake-webm-bytes'));
    storage = new StorageService({
      get: (key: string) => (key === 'uploadsDir' ? root : undefined),
    } as never);
    storage.onModuleInit();
  });

  afterAll(() => {
    resetUploadsRootCache();
    delete process.env.UPLOADS_DIR;
    if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  });

  function buildService(access: { assertCanRead: jest.Mock }) {
    const attachmentRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    const voiceRepo = { save: jest.fn() };
    const messages = {
      createTyped: jest.fn(),
      getHydrated: jest.fn(),
      broadcastCreated: jest.fn(),
    };
    const service = new ChatAttachmentsService(
      attachmentRepo as never,
      voiceRepo as never,
      access as never,
      messages as never,
      storage,
    );
    return { service, attachmentRepo };
  }

  it('allows any chat member (not only the sender) to resolve the file', async () => {
    const access = {
      assertCanRead: jest.fn().mockResolvedValue({ id: 'chat-1' }),
    };
    const { service, attachmentRepo } = buildService(access);
    attachmentRepo.findOne.mockResolvedValue({
      id: 'att-1',
      kind: ChatAttachmentKind.Voice,
      storageKey,
      mime: 'audio/webm',
      originalFilename: storageKey,
      message: {
        id: 'msg-1',
        chatId: 'chat-1',
        senderUserId: 'user-a',
        deletedAt: null,
      },
    });

    const peer = { sub: 'user-b', email: 'b@test', role: 'student' };
    const file = await service.resolveFile(peer, 'att-1');

    expect(access.assertCanRead).toHaveBeenCalledWith(peer, 'chat-1');
    expect(file.absolutePath).toContain(storageKey);
    expect(file.size).toBeGreaterThan(0);
  });

  it('denies outsiders who are not chat members', async () => {
    const access = {
      assertCanRead: jest
        .fn()
        .mockRejectedValue(new ForbiddenException('Chat membership is required')),
    };
    const { service, attachmentRepo } = buildService(access);
    attachmentRepo.findOne.mockResolvedValue({
      id: 'att-1',
      kind: ChatAttachmentKind.Voice,
      storageKey,
      mime: 'audio/webm',
      message: {
        id: 'msg-1',
        chatId: 'chat-1',
        senderUserId: 'user-a',
        deletedAt: null,
      },
    });

    await expect(
      service.resolveFile({ sub: 'outsider', email: 'x@test', role: 'student' }, 'att-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('hides attachments of soft-deleted messages', async () => {
    const access = { assertCanRead: jest.fn() };
    const { service, attachmentRepo } = buildService(access);
    attachmentRepo.findOne.mockResolvedValue({
      id: 'att-1',
      storageKey,
      message: {
        id: 'msg-1',
        chatId: 'chat-1',
        senderUserId: 'user-a',
        deletedAt: new Date(),
      },
    });

    await expect(
      service.resolveFile({ sub: 'user-b', email: 'b@test', role: 'student' }, 'att-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(access.assertCanRead).not.toHaveBeenCalled();
  });
});
