import { apiFetch } from '@/api/http';

/**
 * Backend-authoritative material access check.
 */
export async function hasAccessToMaterial(userId, materialId) {
  const result = await apiFetch(`/material-access/check/${materialId}`);
  return Boolean(result.has_access);
}

/**
 * Выдает доступ к материалу
 * @param {string} userId - ID пользователя
 * @param {string} materialId - ID материала
 * @param {string} grantedByRole - ADMIN или TEACHER
 * @param {string} grantedByUserId - ID пользователя, который выдает доступ
 * @returns {Promise}
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
    granted_by_role: grantedByRole,
  });

  if (existing.length > 0) {
    await api.entities.MaterialAccess.update(existing[0].id, {
      access: true,
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
 * Отзывает доступ у пользователя
 */
export async function revokeAccess(userId, materialId, revokedByRole) {
  const { api } = await import('@/api');

  const existing = await api.entities.MaterialAccess.filter({
    user_id: userId,
    material_id: materialId,
    granted_by_role: revokedByRole,
  });

  if (existing.length > 0) {
    await api.entities.MaterialAccess.delete(existing[0].id);
  }

  if (revokedByRole === 'ADMIN') {
    await api.entities.MaterialAccess.create({
      user_id: userId,
      material_id: materialId,
      granted_by_role: 'ADMIN',
      access: false,
    });
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
