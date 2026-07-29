import { Injectable } from '@nestjs/common';
import { AiProvider } from './ai-provider.interface';

@Injectable()
export class MockAiProvider implements AiProvider {
  complete(prompt: string): Promise<string> {
    return Promise.resolve(`AI assistant received: ${prompt}`);
  }
}
