import { Injectable, Logger } from '@nestjs/common';
import {
  AI_USER_MESSAGES,
  AiCompletionInput,
  AiProvider,
} from './ai-provider.interface';

/**
 * Used when no LLM API key is configured.
 * Never echoes prompts or system instructions to the client.
 */
@Injectable()
export class UnavailableAiProvider implements AiProvider {
  readonly name = 'unavailable';
  private readonly logger = new Logger(UnavailableAiProvider.name);

  isConfigured(): boolean {
    return false;
  }

  complete(input: AiCompletionInput): Promise<string> {
    this.logger.warn(
      `AI unavailable provider=unavailable userMessageChars=${input.userMessage?.length ?? 0}`,
    );
    return Promise.reject(new Error('AI_NOT_CONFIGURED'));
  }

  static get userMessage(): string {
    return AI_USER_MESSAGES.notConfigured;
  }
}
