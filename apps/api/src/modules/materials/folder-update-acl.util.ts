import { ForbiddenException } from '@nestjs/common';
import { normalizeRole } from '../../common/constants/roles';
import { UpdateMaterialFolderDto } from './dto/update-material-folder.dto';

/**
 * Pure ACL for material folder updates — unit-testable without Nest DI / DB.
 *
 * Admin: any field.
 * Teacher / tutor: only folders they own (`createdByUserId`), and only `name`.
 */
export function assertCanUpdateMaterialFolder(
  actor: { sub: string; role: string },
  folder: { createdByUserId: string | null },
  dto: UpdateMaterialFolderDto,
): void {
  const role = normalizeRole(actor.role);

  if (role === 'admin') {
    return;
  }

  if (role !== 'teacher' && role !== 'tutor') {
    throw new ForbiddenException('Недостаточно прав для изменения папки');
  }

  if (folder.createdByUserId !== actor.sub) {
    throw new ForbiddenException('Можно переименовывать только свои папки');
  }

  const touchingStructure =
    dto.courseTemplateId !== undefined ||
    dto.parentId !== undefined ||
    dto.sortOrder !== undefined;

  if (touchingStructure) {
    throw new ForbiddenException(
      'Разрешено изменять только название своей папки',
    );
  }

  if (dto.name === undefined) {
    throw new ForbiddenException(
      'Разрешено изменять только название своей папки',
    );
  }
}

export function canRenameMaterialFolder(
  actor: { sub: string; role: string },
  folder: { createdByUserId: string | null },
): boolean {
  const role = normalizeRole(actor.role);
  if (role === 'admin') return true;
  if (role !== 'teacher' && role !== 'tutor') return false;
  return folder.createdByUserId === actor.sub;
}
