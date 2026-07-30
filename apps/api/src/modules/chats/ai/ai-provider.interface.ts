export type AiCompletionInput = {
  /** User-visible request text only — never include system instructions here for logging to clients. */
  userMessage: string;
  /** Optional server-side system instructions (never returned to the client). */
  systemPrompt?: string;
};

export interface AiProvider {
  readonly name: string;
  complete(input: AiCompletionInput): Promise<string>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');

export const AI_UNAVAILABLE_USER_MESSAGE = 'Longhua AI сейчас недоступен.';
