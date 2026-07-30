import { Injectable, Logger } from '@nestjs/common';
import { AiCompletionInput, AiProvider } from './ai-provider.interface';

/**
 * Test-only provider. Never used in production wiring.
 * Returns a fixed benign answer — never echoes the prompt.
 */
@Injectable()
export class MockAiProvider implements AiProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockAiProvider.name);

  complete(input: AiCompletionInput): Promise<string> {
    this.logger.debug(
      `Mock AI completion (userMessage length=${input.userMessage?.length ?? 0})`,
    );
    return Promise.resolve('Это тестовый ответ Longhua AI.');
  }
}
