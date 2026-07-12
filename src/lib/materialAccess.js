import { apiFetch } from '@/api/http';

/**
 * Backend-authoritative material access check.
 */
export async function hasAccessToMaterial(userId, materialId) {
  const result = await apiFetch(`/material-access/check/${materialId}`);
  return Boolean(result.has_access);
}

async function getGrantedMaterialIds(userId) {
  const editor = await fetchUserAccessEditor(userId);
  const ids = new Set();

  for (const course of editor.courses || []) {
    for (const material of course.materials || []) {
      if (material.has_access) {
        ids.add(material.id);
      }
    }
  }

  return ids;
}

/**
 * Выдаёт доступ к материалу (единая запись на user_id + material_id).
 * grantedByRole — только аудит «кто последним изменил», не влияет на проверку доступа.
 */
export async function grantAccess(userId, materialId, grantedByRole, grantedByUserId) {
  const { api } = await import('@/api');

  if (grantedByRole === 'TEACHER') {
    const student = await api.students.filter({
      user_id: userId,
    });

    if (!student.length) {
      throw new Error('Студент не найден');
    }

    const teacher = await api.teachers.filter({
      user_id: grantedByUserId,
    });

    if (!teacher.length) {
      throw new Error('Учитель не найден');
    }

    if (student[0].assigned_teacher !== teacher[0].id) {
      throw new Error('Это не ваш ученик');
    }
  }

  const materialIds = await getGrantedMaterialIds(userId);
  materialIds.add(materialId);

  await api.materials.access.sync({
    user_id: userId,
    material_ids: Array.from(materialIds),
    granted_by_role: grantedByRole,
  });
}

/**
 * Отзывает доступ (удаляет единую запись user_id + material_id).
 */
export async function revokeAccess(userId, materialId) {
  const { api } = await import('@/api');

  const materialIds = await getGrantedMaterialIds(userId);
  materialIds.delete(materialId);

  await api.materials.access.sync({
    user_id: userId,
    material_ids: Array.from(materialIds),
  });
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
