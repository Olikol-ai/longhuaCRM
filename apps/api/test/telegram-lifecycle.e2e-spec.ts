import { ConfigService } from '@nestjs/config';
import { TelegramPollingService } from '../src/modules/telegram/telegram.polling.service';
import { TelegramWebhookLifecycleService } from '../src/modules/telegram/telegram-webhook.lifecycle';
import {
  assertHttpsTelegramWebhookUrl,
  resolveTelegramMode,
} from '../src/modules/telegram/telegram-mode.util';
import { TelegramGateway } from '../src/modules/telegram/telegram.gateway';
import { TelegramService } from '../src/modules/telegram/telegram.service';

describe('Telegram mode helpers', () => {
  it('defaults to polling outside production when TELEGRAM_MODE is unset', () => {
    expect(resolveTelegramMode(undefined, 'development')).toBe('polling');
    expect(resolveTelegramMode('', 'test')).toBe('polling');
  });

  it('defaults to webhook in production when TELEGRAM_MODE is unset', () => {
    expect(resolveTelegramMode(undefined, 'production')).toBe('webhook');
  });

  it('honours explicit TELEGRAM_MODE', () => {
    expect(resolveTelegramMode('polling', 'production')).toBe('polling');
    expect(resolveTelegramMode('webhook', 'development')).toBe('webhook');
  });

  it('requires a valid HTTPS webhook URL', () => {
    expect(assertHttpsTelegramWebhookUrl('https://crm.example.com/api/telegram/webhook')).toBe(
      'https://crm.example.com/api/telegram/webhook',
    );
    expect(() => assertHttpsTelegramWebhookUrl(undefined)).toThrow(/TELEGRAM_WEBHOOK_URL/);
    expect(() => assertHttpsTelegramWebhookUrl('http://example.com/hook')).toThrow(/HTTPS/);
    expect(() => assertHttpsTelegramWebhookUrl('not-a-url')).toThrow(/valid URL/);
  });
});

describe('TelegramWebhookLifecycleService', () => {
  function createLifecycle(configMap: Record<string, unknown>) {
    const telegramService = {
      deleteWebhook: jest.fn().mockResolvedValue({ ok: true }),
      registerWebhook: jest.fn().mockResolvedValue({ set: { ok: true } }),
      getWebhookInfo: jest.fn().mockResolvedValue({ result: { url: '' } }),
    };
    const config = {
      get: jest.fn((key: string) => configMap[key]),
    } as unknown as ConfigService;

    const service = new TelegramWebhookLifecycleService(
      telegramService as unknown as TelegramService,
      config,
    );
    return { service, telegramService };
  }

  it('does not call setWebhook or deleteWebhook in polling mode', async () => {
    const { service, telegramService } = createLifecycle({
      'telegram.enabled': true,
      'telegram.mock': false,
      'telegram.mode': 'polling',
      'telegram.webhookUrl': 'https://example.com/api/telegram/webhook',
    });

    await service.onApplicationBootstrap();

    expect(telegramService.registerWebhook).not.toHaveBeenCalled();
    expect(telegramService.deleteWebhook).not.toHaveBeenCalled();
  });

  it('registers webhook when mode is webhook and URL is HTTPS', async () => {
    const url = 'https://crm.example.com/api/telegram/webhook';
    const { service, telegramService } = createLifecycle({
      'telegram.enabled': true,
      'telegram.mock': false,
      'telegram.mode': 'webhook',
      'telegram.webhookUrl': url,
      'telegram.webhookSecret': 'secret',
    });

    await service.onApplicationBootstrap();

    expect(telegramService.deleteWebhook).not.toHaveBeenCalled();
    expect(telegramService.registerWebhook).toHaveBeenCalledWith(url, 'secret');
  });

  it('does not delete webhook on graceful shutdown (survives restart)', async () => {
    const { service, telegramService } = createLifecycle({
      'telegram.enabled': true,
      'telegram.mock': false,
      'telegram.mode': 'webhook',
      'telegram.webhookUrl': 'https://crm.example.com/api/telegram/webhook',
    });

    await service.beforeApplicationShutdown();

    expect(telegramService.deleteWebhook).not.toHaveBeenCalled();
  });

  it('does not register webhook when TELEGRAM_WEBHOOK_URL is missing or not HTTPS', async () => {
    const { service, telegramService } = createLifecycle({
      'telegram.enabled': true,
      'telegram.mock': false,
      'telegram.mode': 'webhook',
      'telegram.webhookUrl': 'http://insecure.example/hook',
      'appPublicUrl': 'https://should-not-be-used.example',
    });

    await service.onApplicationBootstrap();

    expect(telegramService.registerWebhook).not.toHaveBeenCalled();
  });
});

describe('TelegramPollingService', () => {
  it('clears webhook once then starts polling', async () => {
    const deleteWebhook = jest.fn().mockResolvedValue({ ok: true });
    const getUpdates = jest.fn().mockImplementation(
      (_offset?: number, _timeout?: number, signal?: AbortSignal) =>
        new Promise((resolve) => {
          const finish = (value: { ok: boolean; result?: unknown[]; error?: string }) => {
            clearTimeout(timer);
            resolve(value);
          };
          const timer = setTimeout(() => finish({ ok: true, result: [] }), 100);
          signal?.addEventListener('abort', () => finish({ ok: false, error: 'aborted' }));
        }),
    );
    const clearBotCommands = jest.fn().mockResolvedValue({ ok: true });
    const telegramService = {
      deleteWebhook,
      clearBotCommands,
      handleUpdate: jest.fn(),
    };
    const gateway = {
      deleteWebhook: jest.fn(),
      getUpdates,
    };
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'telegram.enabled') return true;
        if (key === 'telegram.mode') return 'polling';
        if (key === 'telegram.mock') return false;
        if (key === 'telegram.botToken') return '123:ABC';
        return undefined;
      }),
    } as unknown as ConfigService;

    const service = new TelegramPollingService(
      config,
      gateway as unknown as TelegramGateway,
      telegramService as unknown as TelegramService,
      {
        setPollingRunning: jest.fn(),
        markUpdateReceived: jest.fn(),
      } as never,
    );

    const logs: string[] = [];
    Object.defineProperty(service, 'logger', {
      value: {
        log: (message: string) => logs.push(message),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
    });

    await service.onApplicationBootstrap();
    expect(deleteWebhook).toHaveBeenCalledTimes(1);
    expect(clearBotCommands).toHaveBeenCalledTimes(1);
    expect(gateway.deleteWebhook).not.toHaveBeenCalled();
    expect(logs).toContain('Telegram polling started');

    await service.beforeApplicationShutdown();
  });

  it('does not start polling when TELEGRAM_MODE=webhook', async () => {
    const deleteWebhook = jest.fn();
    const getUpdates = jest.fn();
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'telegram.enabled') return true;
        if (key === 'telegram.mode') return 'webhook';
        if (key === 'telegram.mock') return false;
        if (key === 'telegram.botToken') return '123:ABC';
        return undefined;
      }),
    } as unknown as ConfigService;

    const service = new TelegramPollingService(
      config,
      { getUpdates, deleteWebhook: jest.fn() } as unknown as TelegramGateway,
      { deleteWebhook, handleUpdate: jest.fn() } as unknown as TelegramService,
      {
        setPollingRunning: jest.fn(),
        markUpdateReceived: jest.fn(),
      } as never,
    );

    await service.onApplicationBootstrap();
    expect(deleteWebhook).not.toHaveBeenCalled();
    expect(getUpdates).not.toHaveBeenCalled();
  });

  it('skips polling when TELEGRAM_MOCK=true', async () => {
    const deleteWebhook = jest.fn();
    const getUpdates = jest.fn();
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'telegram.enabled') return true;
        if (key === 'telegram.mode') return 'polling';
        if (key === 'telegram.mock') return true;
        if (key === 'telegram.botToken') return '123:ABC';
        return undefined;
      }),
    } as unknown as ConfigService;

    const service = new TelegramPollingService(
      config,
      { getUpdates, deleteWebhook: jest.fn() } as unknown as TelegramGateway,
      { deleteWebhook, handleUpdate: jest.fn() } as unknown as TelegramService,
      {
        setPollingRunning: jest.fn(),
        markUpdateReceived: jest.fn(),
      } as never,
    );

    const logs: string[] = [];
    Object.defineProperty(service, 'logger', {
      value: {
        log: (message: string) => logs.push(message),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
    });

    await service.onApplicationBootstrap();
    expect(deleteWebhook).not.toHaveBeenCalled();
    expect(getUpdates).not.toHaveBeenCalled();
    expect(logs.some((line) => line.includes('TELEGRAM_MOCK=true'))).toBe(true);
  });

  it('starts real polling when TELEGRAM_MOCK=false', async () => {
    const deleteWebhook = jest.fn().mockResolvedValue({ ok: true });
    const getUpdates = jest.fn().mockImplementation(
      (_offset?: number, _timeout?: number, signal?: AbortSignal) =>
        new Promise((resolve) => {
          const finish = (value: { ok: boolean; result?: unknown[]; error?: string }) => {
            clearTimeout(timer);
            resolve(value);
          };
          const timer = setTimeout(() => finish({ ok: true, result: [] }), 100);
          signal?.addEventListener('abort', () => finish({ ok: false, error: 'aborted' }));
        }),
    );
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'telegram.enabled') return true;
        if (key === 'telegram.mode') return 'polling';
        if (key === 'telegram.mock') return false;
        if (key === 'telegram.botToken') return '123:ABC';
        return undefined;
      }),
    } as unknown as ConfigService;

    const clearBotCommands = jest.fn().mockResolvedValue({ ok: true });
    const service = new TelegramPollingService(
      config,
      { getUpdates, deleteWebhook: jest.fn() } as unknown as TelegramGateway,
      { deleteWebhook, clearBotCommands, handleUpdate: jest.fn() } as unknown as TelegramService,
      {
        setPollingRunning: jest.fn(),
        markUpdateReceived: jest.fn(),
      } as never,
    );

    const logs: string[] = [];
    Object.defineProperty(service, 'logger', {
      value: {
        log: (message: string) => logs.push(message),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
    });

    await service.onApplicationBootstrap();
    expect(deleteWebhook).toHaveBeenCalledTimes(1);
    expect(clearBotCommands).toHaveBeenCalledTimes(1);
    expect(logs).toContain('Telegram polling started');
    await service.beforeApplicationShutdown();
  });
});
