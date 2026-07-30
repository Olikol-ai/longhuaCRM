export type AiCompletionInput = {
  /** User-visible request text only — never include system instructions here for logging to clients. */
  userMessage: string;
  /** Optional server-side system instructions (never returned to the client). */
  systemPrompt?: string;
};

export interface AiProvider {
  readonly name: string;
  /** Optional — providers without a key should report false. */
  isConfigured?(): boolean;
  complete(input: AiCompletionInput): Promise<string>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');

/** @deprecated Prefer AI_USER_MESSAGES — kept for older call sites. */
export const AI_UNAVAILABLE_USER_MESSAGE = 'Longhua AI временно недоступен.';

export const AI_USER_MESSAGES = {
  notConfigured: 'AI не настроен.',
  unavailable: 'Longhua AI временно недоступен.',
  processingError: 'Ошибка обработки запроса.',
} as const;

/**
 * Map provider error codes to short Russian user-facing messages.
 * Never includes prompts, keys, or stack traces.
 */
export function userMessageForAiError(err: unknown): string {
  const code = err instanceof Error ? err.message : String(err || '');
  if (code === 'AI_NOT_CONFIGURED') return AI_USER_MESSAGES.notConfigured;
  if (
    code === 'AI_REQUEST_FAILED' ||
    code === 'AI_NETWORK_ERROR' ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    /fetch failed|network|ECONNRESET|ENOTFOUND/i.test(code)
  ) {
    return AI_USER_MESSAGES.unavailable;
  }
  if (
    code === 'AI_HTTP_ERROR' ||
    code === 'AI_BAD_RESPONSE' ||
    code === 'AI_EMPTY_CONTENT' ||
    code === 'AI_MODEL_ERROR' ||
    code === 'EMPTY_USER_MESSAGE'
  ) {
    return AI_USER_MESSAGES.processingError;
  }
  return AI_USER_MESSAGES.unavailable;
}
