/**
 * Classify a stored material file_url for open/download.
 * External http(s) links (Canva, Google, YouTube, generic) must never be
 * treated as local blobs or rewritten into user-specific signed URLs.
 */

export type MaterialUrlKind =
  | 'empty'
  | 'external-canva'
  | 'external-http'
  | 'local-upload';

export type MaterialUrlClassification = {
  kind: MaterialUrlKind;
  hostname: string | null;
  openUrl: string | null;
};

const SIGNED_PREFIX = '/api/files/signed/';

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isCanvaHostname(hostname: string | null | undefined): boolean {
  if (!hostname) return false;
  const host = hostname.toLowerCase();
  return host === 'canva.com' || host.endsWith('.canva.com');
}

/**
 * Turn a stored value into an absolute http(s) URL, or null if it is a
 * local upload key / signed path / empty.
 */
export function coerceExternalHttpUrl(raw: string | null | undefined): string | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  if (value.startsWith(SIGNED_PREFIX)) return null;
  if (value.startsWith('/')) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  if (/^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(value)) {
    return `https://${value}`;
  }
  return null;
}

export function classifyMaterialFileUrl(
  fileUrl: string | null | undefined,
): MaterialUrlClassification {
  const raw = String(fileUrl ?? '').trim();
  if (!raw) {
    return { kind: 'empty', hostname: null, openUrl: null };
  }
  if (raw.startsWith(SIGNED_PREFIX)) {
    return { kind: 'local-upload', hostname: null, openUrl: raw };
  }

  const http = coerceExternalHttpUrl(raw);
  if (http) {
    const hostname = hostnameOf(http);
    if (isCanvaHostname(hostname)) {
      return { kind: 'external-canva', hostname, openUrl: http };
    }
    return { kind: 'external-http', hostname, openUrl: http };
  }

  return { kind: 'local-upload', hostname: null, openUrl: raw };
}

export function isExternalMaterialUrl(fileUrl: string | null | undefined): boolean {
  const kind = classifyMaterialFileUrl(fileUrl).kind;
  return kind === 'external-canva' || kind === 'external-http';
}
