import { ChatAiService } from './chat-ai.service';
import { AI_UNAVAILABLE_USER_MESSAGE } from './ai-provider.interface';
import { MockAiProvider } from './mock-ai.provider';
import { UnavailableAiProvider } from './unavailable-ai.provider';

describe('ChatAiService', () => {
  function build(provider: { name: string; complete: jest.Mock }) {
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
      complete: jest.fn(async ({ userMessage, systemPrompt }) =>
        `AI assistant received: ${systemPrompt}\n${userMessage}`,
      ),
    };
    const { service } = build(provider);
    const result = await service.explainEphemeral(
      { sub: 'u1', email: 'a@b.c', role: 'student' },
      'буська',
    );
    expect(result.reply).toBe(AI_UNAVAILABLE_USER_MESSAGE);
  });

  it('returns unavailable message when provider throws', async () => {
    const provider = {
      name: 'openai',
      complete: jest.fn(async () => {
        throw new Error('AI_HTTP_ERROR');
      }),
    };
    const { service } = build(provider);
    const result = await service.explainEphemeral(
      { sub: 'u1', email: 'a@b.c', role: 'student' },
      '你好',
    );
    expect(result.reply).toBe(AI_UNAVAILABLE_USER_MESSAGE);
  });
});

describe('AI providers safety', () => {
  it('UnavailableAiProvider never echoes the user message as a prompt dump', async () => {
    const provider = new UnavailableAiProvider();
    const reply = await provider.complete({
      userMessage: 'буська',
      systemPrompt: 'SECRET SYSTEM',
    });
    expect(reply).toBe(AI_UNAVAILABLE_USER_MESSAGE);
    expect(reply).not.toContain('буська');
    expect(reply).not.toContain('SECRET');
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
