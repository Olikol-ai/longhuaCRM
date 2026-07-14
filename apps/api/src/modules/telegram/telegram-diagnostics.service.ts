import { Injectable } from '@nestjs/common';

export type TelegramDebugEvent = {
  at: string;
  kind: 'command' | 'callback' | 'outbound' | 'link';
  summary: string;
  chatId?: string;
  payload?: string;
};

/**
 * In-memory diagnostics for admin GET /telegram/admin/status.
 * Not persisted — resets on process restart.
 */
@Injectable()
export class TelegramDiagnosticsService {
  private lastCommand: TelegramDebugEvent | null = null;
  private lastCallback: TelegramDebugEvent | null = null;
  private lastOutbound: TelegramDebugEvent | null = null;
  private lastLink: TelegramDebugEvent | null = null;
  private pollingRunning = false;
  private receivedUpdateCount = 0;

  recordCommand(chatId: string, text: string) {
    this.lastCommand = {
      at: new Date().toISOString(),
      kind: 'command',
      chatId,
      summary: text.slice(0, 200),
      payload: text.slice(0, 200),
    };
  }

  recordCallback(chatId: string, data: string) {
    this.lastCallback = {
      at: new Date().toISOString(),
      kind: 'callback',
      chatId,
      summary: data.slice(0, 200),
      payload: data.slice(0, 200),
    };
  }

  recordOutbound(chatId: string | number, text: string) {
    this.lastOutbound = {
      at: new Date().toISOString(),
      kind: 'outbound',
      chatId: String(chatId),
      summary: text.slice(0, 200),
    };
  }

  recordLink(chatId: string, userHint: string) {
    this.lastLink = {
      at: new Date().toISOString(),
      kind: 'link',
      chatId,
      summary: userHint.slice(0, 200),
    };
  }

  markUpdateReceived() {
    this.receivedUpdateCount += 1;
  }

  setPollingRunning(running: boolean) {
    this.pollingRunning = running;
  }

  snapshot() {
    return {
      pollingRunning: this.pollingRunning,
      receivedUpdateCount: this.receivedUpdateCount,
      lastCommand: this.lastCommand,
      lastCallback: this.lastCallback,
      lastOutboundMessage: this.lastOutbound,
      lastLink: this.lastLink,
    };
  }
}
