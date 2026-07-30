import { Injectable, Logger } from '@nestjs/common';
import {
  AI_UNAVAILABLE_USER_MESSAGE,
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

  complete(input: AiCompletionInput): Promise<string> {
    this.logger.warn(
      `AI unavailable — rejected completion (userMessage length=${input.userMessage?.length ?? 0})`,
    );
    return Promise.resolve(AI_UNAVAILABLE_USER_MESSAGE);
  }
}
