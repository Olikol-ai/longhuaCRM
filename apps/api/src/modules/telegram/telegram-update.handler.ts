import { Injectable, Logger } from '@nestjs/common';
import { LessonConfirmationService } from '../lesson-confirmations/lesson-confirmation.service';
import { TelegramDiagnosticsService } from './telegram-diagnostics.service';
import { TelegramMenuService } from './telegram-menu.service';
import {
  matchMainMenuButton,
  TELEGRAM_CB,
  TELEGRAM_MSG,
  resultBackToMenuKeyboard,
} from './telegram-messages';
import { TelegramGateway } from './telegram.gateway';
import { TelegramLinkService } from './telegram-link.service';

type MenuAction =
  | 'lessons'
  | 'balance'
  | 'settings'
  | 'profile'
  | 'help'
  | 'main';

/**
 * Single entry point for Telegram updates (polling + webhook).
 * Button-first UX: inline menu + lesson confirm/decline. Deep-link for binding only.
 * Navigation uses InlineKeyboardMarkup; sticky ReplyKeyboard is cleared on contact.
 */
const STICKY_KEYBOARD_CACHE_MAX = 2_000;

@Injectable()
export class TelegramUpdateHandler {
  private readonly logger = new Logger(TelegramUpdateHandler.name);
  /** Chats where we already pulsed ReplyKeyboardRemove in this process (bounded LRU). */
  private readonly stickyKeyboardCleared = new Map<string, true>();

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

      // Other messages / legacy reply-keyboard taps
      await this.ensureStickyKeyboardCleared(chatId, false);

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
      await this.ensureStickyKeyboardCleared(chatId, true);
      await this.reply(chatId, TELEGRAM_MSG.linkFailed);
    }
    return { ok: true };
  }

  private async handleStart(chatId: string) {
    this.logger.log(`Handling /start for chat_id=${chatId}`);
    const linked = await this.linkService.isChatLinked(chatId);
    if (!linked) {
      this.logger.warn(`/start for unlinked chatId=${chatId}`);
      await this.ensureStickyKeyboardCleared(chatId, true);
      await this.reply(chatId, TELEGRAM_MSG.startNotLinked);
      return { ok: true };
    }
    await this.sendMainMenu(chatId);
    return { ok: true };
  }

  /** Always clears sticky keyboard, then shows inline main menu. */
  private async sendMainMenu(chatId: string) {
    await this.ensureStickyKeyboardCleared(chatId, true);
    const screen = this.menu.buildMainMenuInlineScreen();
    await this.menu.sendScreen(chatId, screen);
    this.diagnostics.recordOutbound(chatId, screen.text);
  }

  private async ensureStickyKeyboardCleared(
    chatId: string,
    force: boolean,
  ): Promise<void> {
    if (!force && this.stickyKeyboardCleared.has(chatId)) {
      // Touch for LRU ordering.
      this.stickyKeyboardCleared.delete(chatId);
      this.stickyKeyboardCleared.set(chatId, true);
      return;
    }
    await this.menu.clearStickyReplyKeyboard(chatId);
    this.stickyKeyboardCleared.delete(chatId);
    this.stickyKeyboardCleared.set(chatId, true);
    while (this.stickyKeyboardCleared.size > STICKY_KEYBOARD_CACHE_MAX) {
      const oldest = this.stickyKeyboardCleared.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.stickyKeyboardCleared.delete(oldest);
    }
  }

  private async handleMenuAction(
    chatId: string,
    action: MenuAction,
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
    } else if (action === 'balance') {
      screen = await this.menu.buildBalanceScreen(chatId);
    } else if (action === 'settings') {
      screen = await this.menu.buildSettingsScreen(chatId);
    } else if (action === 'help') {
      screen = this.menu.buildHelpScreen();
    } else {
      screen = await this.menu.buildProfileScreen(chatId);
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
    await this.ensureStickyKeyboardCleared(chatId, false);

    const confirmMatch = data.match(/^lesson_confirm:(.+)$/);
    if (confirmMatch) {
      return this.handleLessonCallback(
        callbackId,
        chatId,
        messageId,
        'confirm',
        confirmMatch[1],
      );
    }

    const declineMatch = data.match(/^lesson_decline:(.+)$/);
    if (declineMatch) {
      return this.handleLessonCallback(
        callbackId,
        chatId,
        messageId,
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
    if (data === TELEGRAM_CB.balance) {
      await this.gateway.answerCallbackQuery(callbackId);
      return this.handleMenuAction(chatId, 'balance', messageId);
    }
    if (data === TELEGRAM_CB.settings) {
      await this.gateway.answerCallbackQuery(callbackId);
      return this.handleMenuAction(chatId, 'settings', messageId);
    }
    if (data === TELEGRAM_CB.profile || data === TELEGRAM_CB.status) {
      await this.gateway.answerCallbackQuery(callbackId);
      return this.handleMenuAction(chatId, 'profile', messageId);
    }
    if (data === TELEGRAM_CB.help) {
      await this.gateway.answerCallbackQuery(callbackId);
      return this.handleMenuAction(chatId, 'help', messageId);
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
    messageId: number | null,
    action: 'confirm' | 'decline',
    confirmationId: string,
  ) {
    try {
      const resultText =
        action === 'confirm' ? TELEGRAM_MSG.confirmed : TELEGRAM_MSG.declined;
      if (action === 'confirm') {
        await this.lessonConfirmations.confirm(confirmationId, chatId);
        await this.gateway.answerCallbackQuery(
          callbackId,
          TELEGRAM_MSG.callbackConfirmed,
        );
      } else {
        await this.lessonConfirmations.decline(confirmationId, chatId);
        await this.gateway.answerCallbackQuery(
          callbackId,
          TELEGRAM_MSG.callbackDeclined,
        );
      }

      await this.menu.editOrSendScreen(chatId, messageId, {
        text: resultText,
        options: { replyMarkup: resultBackToMenuKeyboard() },
      });
      this.diagnostics.recordOutbound(chatId, resultText);
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
      await this.menu.editOrSendScreen(chatId, messageId, {
        text: userText,
        options: { replyMarkup: resultBackToMenuKeyboard() },
      });
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
