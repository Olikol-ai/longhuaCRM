import { api } from '@/api';

/**
 * Проверяет, имеет ли пользователь доступ к материалу
 * @param {string} userId - ID пользователя
 * @param {string} materialId - ID материала
 * @returns {Promise<boolean>}
 */
export async function hasAccessToMaterial(userId, materialId) {
  const accesses = await api.entities.MaterialAccess.filter({
    user_id: userId,
    material_id: materialId,
  });

  // 1. Если админ запретил → доступ = FALSE
  const adminDeny = accesses.find(a => a.granted_by_role === "ADMIN" && a.access === false);
  if (adminDeny) return false;

  // 2. Если админ разрешил → доступ = TRUE
  const adminAllow = accesses.find(a => a.granted_by_role === "ADMIN" && a.access === true);
  if (adminAllow) return true;

  // 3. Если учитель разрешил → доступ = TRUE
  const teacherAllow = accesses.find(a => a.granted_by_role === "TEACHER" && a.access === true);
  if (teacherAllow) return true;

  // 4. Иначе → доступ = FALSE
  return false;
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
  // Проверяем, что учитель может выдавать доступ только с access=true
  if (grantedByRole === "TEACHER") {
    // Проверяем, что это его ученик
    const student = await api.entities.Student.filter({
      user_id: userId,
    });

    if (!student.length) {
      throw new Error("Студент не найден");
    }

    const teacher = await api.entities.Teacher.filter({
      user_id: grantedByUserId,
    });

    if (!teacher.length) {
      throw new Error("Учитель не найден");
    }

    // Проверяем, что это его ученик
    if (student[0].assigned_teacher !== teacher[0].id) {
      throw new Error("Это не ваш ученик");
    }
  }

  // Проверяем, есть ли уже запись
  const existing = await api.entities.MaterialAccess.filter({
    user_id: userId,
    material_id: materialId,
    granted_by_role: grantedByRole,
  });

  if (existing.length > 0) {
    // Обновляем
    await api.entities.MaterialAccess.update(existing[0].id, {
      access: true,
    });
  } else {
    // Создаем
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
 * @param {string} userId - ID пользователя
 * @param {string} materialId - ID материала
 * @param {string} revokedByRole - ADMIN или TEACHER
 */
export async function revokeAccess(userId, materialId, revokedByRole) {
  const existing = await api.entities.MaterialAccess.filter({
    user_id: userId,
    material_id: materialId,
    granted_by_role: revokedByRole,
  });

  if (existing.length > 0) {
    await api.entities.MaterialAccess.delete(existing[0].id);
  }

  // Если отзывает админ, создаем запись о запрете
  if (revokedByRole === "ADMIN") {
    await api.entities.MaterialAccess.create({
      user_id: userId,
      material_id: materialId,
      granted_by_role: "ADMIN",
      access: false,
    });
  }
}

/**
 * Фильтрует материалы по доступу пользователя
 * @param {Array} materials - Массив материалов
 * @param {string} userId - ID пользователя
 * @returns {Promise<Array>}
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