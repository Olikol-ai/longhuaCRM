/**
 * Public invite / referral URL helpers.
 * Prefer invite row id as stable ?ref= (server resolves by UUID).
 */

export function isActiveInvite(row) {
  if (!row) return false;
  const revoked = row.revoked_at ?? row.revokedAt ?? null;
  if (revoked) return false;
  const expiresRaw = row.expires_at ?? row.expiresAt;
  const expires = expiresRaw ? new Date(expiresRaw).getTime() : 0;
  return expires > Date.now();
}

export function inviteUrlFromResponse(created) {
  if (!created) return '';
  if (created.path) {
    return `${window.location.origin}${created.path}`;
  }
  const token = created.token || created.id;
  if (token) {
    return `${window.location.origin}/register?ref=${encodeURIComponent(token)}`;
  }
  return '';
}

/** Build share URL from a listed invite row (id is the public ref). */
export function inviteUrlFromRow(row) {
  if (!row?.id) return '';
  return `${window.location.origin}/register?ref=${encodeURIComponent(row.id)}`;
}
