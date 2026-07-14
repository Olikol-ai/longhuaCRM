import { Injectable, Logger } from '@nestjs/common';
import { LessonConfirmationService } from '../lesson-confirmations/lesson-confirmation.service';
import { TelegramDiagnosticsService } from './telegram-diagnostics.service';
import { TelegramMenuService } from './telegram-menu.service';
import {
  matchMainMenuButton,
  TELEGRAM_CB,
  TELEGRAM_MSG,
  mainMenuInlineKeyboard,
} from './telegram-messages';
import { TelegramGateway } from './telegram.gateway';
import { TelegramLinkService } from './telegram-link.service';

/**
 * Single entry point for Telegram updates (polling + webhook).
 * Button-first UX: menu + lesson confirm/decline. Deep-link for binding only.
 */
@Injectable()
export class TelegramUpdateHandler {
  private readonly logger = new Logger(TelegramUpdateHandler.name);

  constructor(
    private readonly gateway: TelegramGateway,
    private readonly linkService: TelegramLinkService,
    private readonly lessonConfirmations: LessonConfirmationService,
    private readonly menu: TelegramMenuService,
    private readonly diagnostics: TelegramDiagnosticsService,
  ) {}

  async handleUpdate(update: Record<string, unknown>) {
    this.diagnostics.markUpdateReceived();
    try {
      if (update.callback_query) {
        return await this.handleCallbackQuery(
          update.callback_query as Record<string, unknown>,
        );
      }

      const message = update.message as
        | {
            text?: string;
            chat?: { id?: number };
            from?: { first_name?: string; username?: string; id?: number };
          }
        | undefined;

      if (!message?.text || !message.chat?.id) {
        return { ok: true };
      }

      const text = message.text.trim();
      const chatId = String(message.chat.id);
      const username = message.from?.username ?? '';
      this.diagnostics.recordCommand(chatId, text);

      const startMatch = text.match(/^\/start(?:\s+(.+))?$/);
      if (startMatch) {
        const payload = startMatch[1]?.trim();
        if (payload) {
          return await this.handleDeepLinkToken(payload, chatId, username);
        }
        return await this.handleStart(chatId);
      }

      const menuAction = matchMainMenuButton(text);
      if (menuAction) {
        return await this.handleMenuAction(chatId, menuAction, null);
      }

      return { ok: true };
    } catch (error) {
      this.logger.error(
        `Unhandled Telegram update error: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return { ok: true };
    }
  }

  private async handleDeepLinkToken(
    token: string,
    chatId: string,
    username: string,
  ) {
    this.logger.log(
      `Telegram deep-link attempt chatId=${chatId} username=${username || '—'}`,
    );
    const linked = await this.linkService.completeLinkByToken(
      token,
      chatId,
      username,
    );
    if (linked) {
      this.diagnostics.recordLink(chatId, `linked @${username || chatId}`);
      await this.sendMainMenu(chatId);
    } else {
      this.logger.warn(
        `Deep-link failed for chatId=${chatId} (invalid/expired/used token)`,
      );
      await this.reply(chatId, TELEGRAM_MSG.linkFailed);
    }
    return { ok: true };
  }

  private async handleStart(chatId: string) {
    this.logger.log(`Handling /start for chat_id=${chatId}`);
    const linked = await this.linkService.isChatLinked(chatId);
    if (!linked) {
      this.logger.warn(`/start for unlinked chatId=${chatId}`);
      await this.reply(chatId, TELEGRAM_MSG.startNotLinked);
      return { ok: true };
    }
    await this.sendMainMenu(chatId);
    return { ok: true };
  }

  private async sendMainMenu(chatId: string) {
    await this.gateway.sendMessage(chatId, TELEGRAM_MSG.startLinked, {
      replyMarkup: mainMenuInlineKeyboard(),
    });
    this.diagnostics.recordOutbound(chatId, TELEGRAM_MSG.startLinked);
  }

  private async handleMenuAction(
    chatId: string,
    action: 'lessons' | 'settings' | 'status' | 'main',
    messageId: number | null,
  ) {
    const linked = await this.linkService.isChatLinked(chatId);
    if (!linked) {
      this.logger.warn(`Menu action="${action}" for unlinked chatId=${chatId}`);
      await this.reply(chatId, TELEGRAM_MSG.notLinkedShort);
      return { ok: true };
    }

    let screen;
    if (action === 'main') {
      screen = this.menu.buildMainMenuInlineScreen();
    } else if (action === 'lessons') {
      screen = await this.menu.buildLessonsScreen(chatId);
    } else if (action === 'settings') {
      screen = await this.menu.buildSettingsScreen(chatId);
    } else {
      screen = await this.menu.buildStatusScreen(chatId);
    }

    await this.menu.editOrSendScreen(chatId, messageId, screen);
    this.diagnostics.recordOutbound(chatId, screen.text);
    return { ok: true };
  }

  private async handleCallbackQuery(callback: Record<string, unknown>) {
    const callbackId = String(callback.id ?? '');
    const data = String(callback.data ?? '');
    const message = callback.message as
      | { chat?: { id?: number }; message_id?: number }
      | undefined;
    const from = callback.from as { username?: string; id?: number } | undefined;
    const chatId = String(message?.chat?.id ?? from?.id ?? '');
    const messageId =
      typeof message?.message_id === 'number' ? message.message_id : null;

    if (!callbackId || !data || !chatId) {
      return { ok: true };
    }

    this.diagnostics.recordCallback(chatId, data);

    const confirmMatch = data.match(/^lesson_confirm:(.+)$/);
    if (confirmMatch) {
      return this.handleLessonCallback(
        callbackId,
        chatId,
        'confirm',
        confirmMatch[1],
      );
    }

    const declineMatch = data.match(/^lesson_decline:(.+)$/);
    if (declineMatch) {
      return this.handleLessonCallback(
        callbackId,
        chatId,
        'decline',
        declineMatch[1],
      );
    }

    if (data === TELEGRAM_CB.main) {
      await this.gateway.answerCallbackQuery(callbackId);
      return this.handleMenuAction(chatId, 'main', messageId);
    }
    if (data === TELEGRAM_CB.lessons) {
      await this.gateway.answerCallbackQuery(callbackId);
      return this.handleMenuAction(chatId, 'lessons', messageId);
    }
    if (data === TELEGRAM_CB.settings) {
      await this.gateway.answerCallbackQuery(callbackId);
      return this.handleMenuAction(chatId, 'settings', messageId);
    }
    if (data === TELEGRAM_CB.status) {
      await this.gateway.answerCallbackQuery(callbackId);
      return this.handleMenuAction(chatId, 'status', messageId);
    }
    if (data === TELEGRAM_CB.toggle24h || data === TELEGRAM_CB.toggle3h) {
      try {
        const screen = await this.menu.toggleNotifyPreference(
          chatId,
          data === TELEGRAM_CB.toggle24h ? '24h' : '3h',
        );
        await this.gateway.answerCallbackQuery(callbackId, 'Сохранено');
        await this.menu.editOrSendScreen(chatId, messageId, screen);
        this.diagnostics.recordOutbound(chatId, screen.text);
      } catch (error) {
        this.logger.warn(
          `Settings toggle failed chatId=${chatId}: ${(error as Error).message}`,
        );
        await this.gateway.answerCallbackQuery(callbackId, 'Ошибка');
        await this.reply(chatId, TELEGRAM_MSG.saveFailed);
      }
      return { ok: true };
    }

    this.logger.warn(`Unknown callback data="${data}" chatId=${chatId}`);
    await this.gateway.answerCallbackQuery(
      callbackId,
      TELEGRAM_MSG.staleButton,
    );
    await this.reply(chatId, TELEGRAM_MSG.staleButton);
    return { ok: true };
  }

  private async handleLessonCallback(
    callbackId: string,
    chatId: string,
    action: 'confirm' | 'decline',
    confirmationId: string,
  ) {
    try {
      if (action === 'confirm') {
        await this.lessonConfirmations.confirm(confirmationId, chatId);
        await this.gateway.answerCallbackQuery(
          callbackId,
          TELEGRAM_MSG.callbackConfirmed,
        );
        await this.reply(chatId, TELEGRAM_MSG.confirmed);
      } else {
        await this.lessonConfirmations.decline(confirmationId, chatId);
        await this.gateway.answerCallbackQuery(
          callbackId,
          TELEGRAM_MSG.callbackDeclined,
        );
        await this.reply(chatId, TELEGRAM_MSG.declined);
      }
    } catch (error) {
      this.logger.warn(
        `Lesson ${action} failed confirmationId=${confirmationId} chatId=${chatId}: ${(error as Error).message}`,
      );
      const userText = this.toUserError(
        error,
        action === 'confirm'
          ? 'Не удалось подтвердить урок.'
          : 'Не удалось отменить урок.',
      );
      await this.gateway.answerCallbackQuery(callbackId, 'Ошибка');
      await this.reply(chatId, userText);
    }
    return { ok: true };
  }

  private toUserError(error: unknown, fallback: string): string {
    const message = (error as Error)?.message?.trim() || '';
    const known = [
      TELEGRAM_MSG.alreadyConfirmed,
      TELEGRAM_MSG.alreadyDeclined,
      TELEGRAM_MSG.staleButton,
      TELEGRAM_MSG.notLinkedShort,
      TELEGRAM_MSG.linkFailed,
    ];
    if (known.includes(message as (typeof known)[number])) {
      return message;
    }
    if (/уже подтвержд/i.test(message)) return TELEGRAM_MSG.alreadyConfirmed;
    if (/уже отмен/i.test(message)) return TELEGRAM_MSG.alreadyDeclined;
    if (/уже обработан|не найден|недействительн|устарел/i.test(message)) {
      return TELEGRAM_MSG.staleButton;
    }
    if (/telegram/i.test(message) && /не /i.test(message)) {
      return TELEGRAM_MSG.notLinkedShort;
    }
    if (/не совпадает|получател/i.test(message)) {
      return TELEGRAM_MSG.staleButton;
    }
    return fallback;
  }

  private async reply(chatId: string, text: string) {
    await this.gateway.sendMessage(chatId, text);
    this.diagnostics.recordOutbound(chatId, text);
  }
}
