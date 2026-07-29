export interface AiProvider {
  complete(prompt: string): Promise<string>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
