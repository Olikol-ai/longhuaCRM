import { Injectable } from '@nestjs/common';
import { AiProvider } from './ai-provider.interface';

@Injectable()
export class OpenAiProvider implements AiProvider {
  complete(_prompt: string): Promise<string> {
    return Promise.reject(new Error('OpenAI provider is not configured'));
  }
}
