import { BadRequestException } from '@nestjs/common';
import { ChatKind, ChatMessageType } from './enums/chat.enums';
import { ChatMessagesService } from './services/chat-messages.service';

describe('ChatMessagesService Direct E2EE', () => {
  function buildService(kind: ChatKind) {
    const messageRepo = {
      save: jest.fn(async (row) => ({ id: 'msg-1', ...row })),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      update: jest.fn(),
    };
    const memberRepo = {
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn(),
      })),
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const chatRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'chat-1', kind }),
    };
    const access = {
      assertCanWrite: jest.fn().mockResolvedValue({ id: 'chat-1', kind }),
      assertCanRead: jest.fn().mockResolvedValue({ id: 'chat-1', kind }),
      isAdmin: jest.fn().mockReturnValue(false),
    };
    const presence = { isOnline: jest.fn().mockReturnValue(true) };
    const notifications = { create: jest.fn() };
    const membershipSync = { addMember: jest.fn().mockResolvedValue({}) };
    const service = new ChatMessagesService(
      messageRepo as never,
      memberRepo as never,
      chatRepo as never,
      access as never,
      presence as never,
      notifications as never,
      membershipSync as never,
      undefined,
    );
    jest.spyOn(service, 'getHydrated').mockResolvedValue({
      id: 'msg-1',
      chatId: 'chat-1',
      type: ChatMessageType.Text,
      body: null,
      ciphertext: 'abc',
    } as never);
    return { service, access, messageRepo };
  }

  const actor = { sub: 'u1', email: 'u1@test', role: 'student' };

  it('rejects plaintext body for Direct chats', async () => {
    const { service } = buildService(ChatKind.Direct);
    await expect(service.createText(actor, 'chat-1', 'hello')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('accepts ciphertext payload for Direct chats', async () => {
    const { service, messageRepo } = buildService(ChatKind.Direct);
    const saved = await service.createEncryptedText(actor, 'chat-1', {
      ciphertext: 'Y2lwaGVy',
      nonce: 'bm9uY2U=',
      algorithm: 'x25519-aes256gcm-v1',
      keyVersion: 1,
    });
    expect(saved.id).toBe('msg-1');
    expect(messageRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        body: null,
        ciphertext: 'Y2lwaGVy',
        nonce: 'bm9uY2U=',
      }),
    );
  });

  it('still accepts plaintext for non-Direct chats', async () => {
    const { service, messageRepo } = buildService(ChatKind.Group);
    await service.createText(actor, 'chat-1', 'hello');
    expect(messageRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'hello', ciphertext: null }),
    );
  });
});
