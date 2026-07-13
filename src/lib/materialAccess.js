import { apiFetch } from '@/api/http';

/**
 * Backend-authoritative material access check for the current user.
 */
export async function hasAccessToMaterial(_userId, materialId) {
  const result = await apiFetch(`/material-access/check/${materialId}`);
  return Boolean(result.has_access);
}

/**
 * Additive grant — does not revoke other materials.
 * targetType: user | student | group | course
 */
export async function grantMaterialAccess({
  materialIds,
  targetType,
  targetId,
  grantedByRole = 'ADMIN',
}) {
  const { api } = await import('@/api');
  return api.materials.access.grant({
    material_ids: materialIds,
    target_type: targetType,
    target_id: targetId,
    granted_by_role: grantedByRole,
  });
}

/**
 * Additive grant for a single user account (legacy helper).
 */
export async function grantAccess(userId, materialId, grantedByRole = 'ADMIN') {
  return grantMaterialAccess({
    materialIds: [materialId],
    targetType: 'user',
    targetId: userId,
    grantedByRole,
  });
}

/**
 * Revoke personal access for a user+material.
 */
export async function revokeAccess(userId, materialId) {
  const { api } = await import('@/api');
  return api.materials.access.revoke({
    material_ids: [materialId],
    target_type: 'user',
    target_id: userId,
  });
}

export async function fetchUserAccessEditor(userId) {
  return apiFetch(`/material-access/user/${userId}/editor`);
}

export async function syncUserMaterialAccess(userId, materialIds) {
  return apiFetch(`/material-access/user/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({ material_ids: materialIds }),
  });
}
