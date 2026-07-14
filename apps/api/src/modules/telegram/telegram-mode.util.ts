/**
 * Resolves Telegram delivery mode from env.
 * Unset TELEGRAM_MODE → polling in non-production (local getUpdates), webhook in production.
 */
export function resolveTelegramMode(
  mode: string | undefined,
  nodeEnv: string | undefined,
): 'polling' | 'webhook' {
  const normalized = (mode ?? '').trim().toLowerCase();
  if (normalized === 'polling') return 'polling';
  if (normalized === 'webhook') return 'webhook';
  return nodeEnv === 'production' ? 'webhook' : 'polling';
}

/**
 * Validates that a Telegram webhook URL is a public HTTPS endpoint.
 * Throws with a clear message when missing or invalid.
 */
export function assertHttpsTelegramWebhookUrl(url: string | undefined | null): string {
  const trimmed = (url ?? '').trim();
  if (!trimmed) {
    throw new Error(
      'TELEGRAM_MODE=webhook requires TELEGRAM_WEBHOOK_URL. ' +
        'Example: https://crm.example.com/api/telegram/webhook',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(
      `TELEGRAM_WEBHOOK_URL is not a valid URL: "${trimmed}". ` +
        'Expected an HTTPS address, e.g. https://crm.example.com/api/telegram/webhook',
    );
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(
      `TELEGRAM_WEBHOOK_URL must use HTTPS (got ${parsed.protocol}//). ` +
        `Value: "${trimmed}"`,
    );
  }

  if (!parsed.hostname) {
    throw new Error(
      `TELEGRAM_WEBHOOK_URL is missing a hostname: "${trimmed}"`,
    );
  }

  return trimmed;
}

export function isValidHttpsTelegramWebhookUrl(url: string | undefined | null): boolean {
  try {
    assertHttpsTelegramWebhookUrl(url);
    return true;
  } catch {
    return false;
  }
}
