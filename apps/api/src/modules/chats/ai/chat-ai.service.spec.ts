import { ChatAiService } from './chat-ai.service';
import {
  AI_USER_MESSAGES,
  userMessageForAiError,
} from './ai-provider.interface';
import { MockAiProvider } from './mock-ai.provider';
import { UnavailableAiProvider } from './unavailable-ai.provider';

describe('ChatAiService', () => {
  function build(provider: {
    name: string;
    complete: jest.Mock;
    isConfigured?: () => boolean;
  }) {
    const messages = {
      createText: jest.fn(async (_a, _c, body) => ({ id: 'u-msg', body })),
      createAiResponse: jest.fn(async (_c, body) => ({
        id: 'a-msg',
        body,
        type: 'ai_response',
      })),
    };
    const access = {
      assertCanWrite: jest.fn(async () => ({ id: 'chat-1', kind: 'group' })),
    };
    const conversationRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(async (row) => ({ id: 'conv-1', ...row })),
    };
    const turnRepo = { save: jest.fn(async (rows) => rows) };
    const service = new ChatAiService(
      provider as never,
      messages as never,
      access as never,
      {} as never,
      conversationRepo as never,
      turnRepo as never,
    );
    return { service, messages };
  }

  it('explainEphemeral returns only the model reply, never the prompt', async () => {
    const provider = {
      name: 'mock',
      isConfigured: () => true,
      complete: jest.fn(async ({ userMessage }) => `Объяснение: ${userMessage}`),
    };
    const { service } = build(provider);
    const result = await service.explainEphemeral(
      { sub: 'u1', email: 'a@b.c', role: 'student' },
      'буська',
    );
    expect(result.reply).toBe('Объяснение: буська');
    expect(result.reply).not.toMatch(/AI assistant received/i);
    expect(result.reply).not.toMatch(/Кратко объясни/);
    expect(provider.complete).toHaveBeenCalledWith(
      expect.objectContaining({ userMessage: 'буська' }),
    );
  });

  it('sanitizes prompt-echo responses into unavailable message', async () => {
    const provider = {
      name: 'bad',
      isConfigured: () => true,
      complete: jest.fn(async ({ userMessage, systemPrompt }) =>
        `AI assistant received: ${systemPrompt}\n${userMessage}`,
      ),
    };
    const { service } = build(provider);
    const result = await service.explainEphemeral(
      { sub: 'u1', email: 'a@b.c', role: 'student' },
      'буська',
    );
    expect(result.reply).toBe(AI_USER_MESSAGES.unavailable);
  });

  it('returns processing error when provider throws model error', async () => {
    const provider = {
      name: 'openai',
      isConfigured: () => true,
      complete: jest.fn(async () => {
        throw new Error('AI_HTTP_ERROR');
      }),
    };
    const { service } = build(provider);
    const result = await service.explainEphemeral(
      { sub: 'u1', email: 'a@b.c', role: 'student' },
      '你好',
    );
    expect(result.reply).toBe(AI_USER_MESSAGES.processingError);
  });

  it('returns not-configured when provider reports missing key', async () => {
    const provider = {
      name: 'unavailable',
      isConfigured: () => false,
      complete: jest.fn(async () => {
        throw new Error('AI_NOT_CONFIGURED');
      }),
    };
    const { service } = build(provider);
    const result = await service.explainEphemeral(
      { sub: 'u1', email: 'a@b.c', role: 'student' },
      'буська',
    );
    expect(result.reply).toBe(AI_USER_MESSAGES.notConfigured);
    expect(provider.complete).not.toHaveBeenCalled();
  });
});

describe('AI providers safety', () => {
  it('maps error codes to Russian user messages', () => {
    expect(userMessageForAiError(new Error('AI_NOT_CONFIGURED'))).toBe(
      AI_USER_MESSAGES.notConfigured,
    );
    expect(userMessageForAiError(new Error('AI_REQUEST_FAILED'))).toBe(
      AI_USER_MESSAGES.unavailable,
    );
    expect(userMessageForAiError(new Error('AI_MODEL_ERROR'))).toBe(
      AI_USER_MESSAGES.processingError,
    );
  });

  it('UnavailableAiProvider never echoes the user message as a prompt dump', async () => {
    const provider = new UnavailableAiProvider();
    await expect(
      provider.complete({
        userMessage: 'буська',
        systemPrompt: 'SECRET SYSTEM',
      }),
    ).rejects.toThrow('AI_NOT_CONFIGURED');
  });

  it('MockAiProvider returns a benign answer without prompt echo', async () => {
    const provider = new MockAiProvider();
    const reply = await provider.complete({
      userMessage: 'Explain Present Perfect',
      systemPrompt: 'internal',
    });
    expect(reply).toBe('Это тестовый ответ Longhua AI.');
    expect(reply).not.toMatch(/AI assistant received/i);
    expect(reply).not.toContain('internal');
  });
});
