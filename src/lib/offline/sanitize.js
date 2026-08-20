/**
 * Strip secrets before persisting snapshots.
 * Never store JWT, Authorization, or access_token query values.
 */

const SENSITIVE_QUERY = /([?&])(access_token|token|authorization)=([^&#]*)/gi;

export function stripAuthFromUrl(url) {
  if (typeof url !== 'string' || !url) return url;
  return url.replace(SENSITIVE_QUERY, '$1$2=REDACTED');
}

function scrubValue(value, depth = 0) {
  if (depth > 12) return null;
  if (value == null) return value;
  if (typeof value === 'string') {
    if (/^Bearer\s+/i.test(value)) return '[redacted]';
    if (value.includes('access_token=') || value.includes('token=')) {
      return stripAuthFromUrl(value);
    }
    return value;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, depth + 1));
  }

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const lower = k.toLowerCase();
    if (
      lower === 'authorization'
      || lower === 'access_token'
      || lower === 'accesstoken'
      || lower === 'jwt'
      || lower === 'password'
      || lower === 'refresh_token'
      || lower === 'privatekey'
      || lower === 'private_key'
    ) {
      continue;
    }
    if (lower === 'url' || lower === 'src' || lower === 'href' || lower.endsWith('_url')) {
      out[k] = typeof v === 'string' ? stripAuthFromUrl(v) : scrubValue(v, depth + 1);
      continue;
    }
    out[k] = scrubValue(v, depth + 1);
  }
  return out;
}

/** Deep-clone JSON-safe payload without auth secrets. */
export function sanitizeForOffline(data) {
  try {
    return scrubValue(JSON.parse(JSON.stringify(data)));
  } catch {
    return scrubValue(data);
  }
}

/** Materials: keep metadata fields only (no binary / no signed URLs with tokens). */
export function sanitizeMaterialMetaList(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list.map((row) => {
    if (!row || typeof row !== 'object') return row;
    return sanitizeForOffline({
      id: row.id,
      name: row.name ?? row.title ?? row.file_name ?? null,
      type: row.type ?? row.mime_type ?? row.mimeType ?? null,
      folder_id: row.folder_id ?? row.folderId ?? null,
      course_id: row.course_id ?? row.courseId ?? null,
      size: row.size ?? row.file_size ?? row.bytes ?? null,
      access: row.access ?? null,
      updated_at: row.updated_at ?? row.updatedAt ?? row.created_date ?? null,
      created_date: row.created_date ?? null,
      owner_id: row.owner_id ?? null,
      file_name: row.file_name ?? null,
    });
  });
}

/** Cap chat messages and scrub attachment URLs. */
export function sanitizeChatMessages(messages, cap = 100) {
  const list = Array.isArray(messages) ? messages : [];
  const sliced = list.length > cap ? list.slice(-cap) : list;
  return sanitizeForOffline(sliced);
}
