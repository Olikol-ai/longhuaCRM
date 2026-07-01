import { apiFetch } from '@/api/http';

/**
 * Backend-authoritative material access check.
 */
export async function hasAccessToMaterial(userId, materialId) {
  const result = await apiFetch(`/material-access/check/${materialId}`);
  return Boolean(result.has_access);
}

/**
 * Выдаёт доступ к материалу (единая запись на user_id + material_id).
 * grantedByRole — только аудит «кто последним изменил», не влияет на проверку доступа.
 */
export async function grantAccess(userId, materialId, grantedByRole, grantedByUserId) {
  const { api } = await import('@/api');

  if (grantedByRole === 'TEACHER') {
    const student = await api.entities.Student.filter({
      user_id: userId,
    });

    if (!student.length) {
      throw new Error('Студент не найден');
    }

    const teacher = await api.entities.Teacher.filter({
      user_id: grantedByUserId,
    });

    if (!teacher.length) {
      throw new Error('Учитель не найден');
    }

    if (student[0].assigned_teacher !== teacher[0].id) {
      throw new Error('Это не ваш ученик');
    }
  }

  const existing = await api.entities.MaterialAccess.filter({
    user_id: userId,
    material_id: materialId,
  });

  if (existing.length > 0) {
    await api.entities.MaterialAccess.update(existing[0].id, {
      access: true,
      granted_by_role: grantedByRole,
    });
  } else {
    await api.entities.MaterialAccess.create({
      user_id: userId,
      material_id: materialId,
      granted_by_role: grantedByRole,
      access: true,
    });
  }
}

/**
 * Отзывает доступ (удаляет единую запись user_id + material_id).
 */
export async function revokeAccess(userId, materialId) {
  const { api } = await import('@/api');

  const existing = await api.entities.MaterialAccess.filter({
    user_id: userId,
    material_id: materialId,
  });

  for (const row of existing) {
    await api.entities.MaterialAccess.delete(row.id);
  }
}

/**
 * Фильтрует материалы по доступу пользователя
 */
export async function filterMaterialsByAccess(materials, userId) {
  const accessibleMaterials = [];

  for (const material of materials) {
    const hasAccess = await hasAccessToMaterial(userId, material.id);
    if (hasAccess) {
      accessibleMaterials.push(material);
    }
  }

  return accessibleMaterials;
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
