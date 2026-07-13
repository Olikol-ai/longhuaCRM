export type MailEnvConfig = {
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  pass: string;
  from?: string;
};

const MAIL_ENV_KEYS = {
  host: ['MAIL_HOST', 'SMTP_HOST'] as const,
  port: ['MAIL_PORT', 'SMTP_PORT'] as const,
  secure: ['MAIL_SECURE', 'SMTP_SECURE'] as const,
  user: ['MAIL_USER', 'SMTP_USER'] as const,
  pass: ['MAIL_PASS', 'SMTP_PASS', 'SMTP_PASSWORD'] as const,
  from: ['MAIL_FROM', 'SMTP_FROM'] as const,
};

function readFirstEnv(keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

export function readMailEnvFromProcess(): MailEnvConfig {
  const portRaw = readFirstEnv(MAIL_ENV_KEYS.port);
  const secureRaw = readFirstEnv(MAIL_ENV_KEYS.secure);

  return {
    host: readFirstEnv(MAIL_ENV_KEYS.host),
    port: portRaw ? parseInt(portRaw, 10) : 465,
    secure: secureRaw ? secureRaw === 'true' : true,
    user: readFirstEnv(MAIL_ENV_KEYS.user),
    pass: readFirstEnv(MAIL_ENV_KEYS.pass) ?? '',
    from: readFirstEnv(MAIL_ENV_KEYS.from),
  };
}

export function getMissingMailConfigKeys(
  mail: Pick<MailEnvConfig, 'host' | 'user' | 'pass'>,
): string[] {
  const missing: string[] = [];

  if (!mail.host) {
    missing.push('SMTP_HOST (or MAIL_HOST)');
  }
  if (!mail.user) {
    missing.push('SMTP_USER (or MAIL_USER)');
  }
  if (!mail.pass) {
    missing.push('SMTP_PASSWORD (or SMTP_PASS / MAIL_PASS)');
  }

  return missing;
}

export function isMailConfigured(
  mail: Pick<MailEnvConfig, 'host' | 'user' | 'pass'>,
): boolean {
  return getMissingMailConfigKeys(mail).length === 0;
}

export function maskMailSecret(value: string | undefined): string {
  if (!value) {
    return '(empty)';
  }
  if (value.length <= 2) {
    return '******';
  }
  return `${value.slice(0, 2)}******`;
}

export function formatSmtpDiagnosticLog(mail: MailEnvConfig): string {
  const missing = getMissingMailConfigKeys(mail);
  const configured = missing.length === 0 ? 'YES' : 'NO';
  const missingLine =
    missing.length > 0 ? `Missing: ${missing.join(', ')}` : 'Missing: none';

  return [
    'SMTP configuration',
    `Host: ${mail.host ?? '(not set)'}`,
    `Port: ${mail.port}`,
    `Secure: ${mail.secure}`,
    `User: ${mail.user ?? '(not set)'}`,
    `Password: ${maskMailSecret(mail.pass)}`,
    `From: ${mail.from ?? '(not set)'}`,
    `Configured: ${configured}`,
    missingLine,
  ].join('\n');
}

export function formatMailConfigError(
  mail: Pick<MailEnvConfig, 'host' | 'user' | 'pass'>,
): string {
  const missing = getMissingMailConfigKeys(mail);
  if (missing.length === 0) {
    return 'SMTP not configured';
  }
  if (missing.length === 1) {
    return `Missing ${missing[0]}`;
  }
  return `Missing ${missing.join(', ')}`;
}
