import { ServiceUnavailableException } from '@nestjs/common';
import {
  TELEGRAM_LINK_UNAVAILABLE_USER_MESSAGE,
  TelegramLinkService,
} from './telegram-link.service';

describe('TelegramLinkService createLink UX', () => {
  const usersRepository = {
    findById: jest.fn(),
    save: jest.fn(async (row: unknown) => row),
  };
  const config = {
    get: jest.fn((_key: string): unknown => undefined),
  };
  const audit = { log: jest.fn() };
  const studentRepo = {};
  const teacherRepo = {};

  const service = new TelegramLinkService(
    usersRepository as never,
    config as never,
    audit as never,
    studentRepo as never,
    teacherRepo as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.TELEGRAM_BOT_USERNAME;
    config.get.mockImplementation((key: string): unknown => {
      if (key === 'telegram.enabled') return true;
      if (key === 'telegram.botToken') return 'token';
      if (key === 'telegram.botUsername') return '';
      if (key === 'TELEGRAM_BOT_USERNAME') return '';
      return undefined;
    });
  });

  it('returns a user-safe message when bot username is missing', async () => {
    usersRepository.findById.mockResolvedValue({
      id: 'u1',
      status: 'active',
    });

    await expect(service.createLink('u1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    try {
      await service.createLink('u1');
    } catch (err) {
      const response = (err as ServiceUnavailableException).getResponse() as {
        message?: string | string[];
      };
      const message = Array.isArray(response.message)
        ? response.message.join(' ')
        : response.message;
      expect(message).toBe(TELEGRAM_LINK_UNAVAILABLE_USER_MESSAGE);
      expect(String(message)).not.toMatch(/TELEGRAM_BOT_USERNAME/i);
      expect(String(message)).not.toMatch(/telegram_bot_username/i);
      expect(String(message)).not.toMatch(/environment/i);
    }

    expect(usersRepository.save).not.toHaveBeenCalled();
  });

  it('strips leading @ from bot username', () => {
    config.get.mockImplementation((key: string): unknown => {
      if (key === 'telegram.botUsername') return '@LonghuaChinese_bot';
      return undefined;
    });
    expect(service.getBotUsername()).toBe('LonghuaChinese_bot');
  });

  it('builds deep link when username is configured', async () => {
    config.get.mockImplementation((key: string): unknown => {
      if (key === 'telegram.botUsername') return 'LonghuaChinese_bot';
      return undefined;
    });
    usersRepository.findById.mockResolvedValue({
      id: 'u1',
      status: 'active',
      telegramLinkToken: null,
      telegramLinkExpires: null,
    });

    const result = await service.createLink('u1');
    expect(result.link).toMatch(
      /^https:\/\/t\.me\/LonghuaChinese_bot\?start=[a-f0-9]+$/,
    );
    expect(usersRepository.save).toHaveBeenCalled();
  });
});
