/**
 * Hard guard for local/agent UI verification scripts.
 * Production must never be the target of scripts that create or mutate CRM data.
 */
export function assertNonProductionBase(baseUrl, { scriptName = 'verify script' } = {}) {
  const raw = String(baseUrl ?? '').trim();
  if (!raw) {
    throw new Error(`${scriptName}: BASE_URL is empty`);
  }

  let host = '';
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    throw new Error(`${scriptName}: invalid BASE_URL: ${raw}`);
  }

  const blockedHosts = [
    'lk.longhuachinese.online',
    'longhuachinese.online',
    'www.longhuachinese.online',
  ];
  if (blockedHosts.includes(host) || host.endsWith('.longhuachinese.online')) {
    throw new Error(
      `${scriptName}: refusing to run against production (${raw}). ` +
        'Use a local/staging BASE_URL (e.g. http://127.0.0.1:3001).',
    );
  }

  return raw.replace(/\/$/, '');
}
