import { EntityName } from './entity-names';
import { AppRole, NormalizedRole } from './roles';

export type CrudAction = 'read' | 'create' | 'update' | 'delete';

export type AccessScope = 'all' | 'own' | 'none';

export interface EntityCrudPermissions {
  read: AccessScope;
  create: AccessScope;
  update: AccessScope;
  delete: AccessScope;
}

export type EntityPermissionsMatrix = Record<
  EntityName,
  Record<AppRole, EntityCrudPermissions>
>;

const fullAccess = (): EntityCrudPermissions => ({
  read: 'all',
  create: 'all',
  update: 'all',
  delete: 'all',
});

const readAll = (): EntityCrudPermissions => ({
  read: 'all',
  create: 'none',
  update: 'none',
  delete: 'none',
});

const readOwn = (): EntityCrudPermissions => ({
  read: 'own',
  create: 'none',
  update: 'none',
  delete: 'none',
});

const readAllWriteAll = (): EntityCrudPermissions => ({
  read: 'all',
  create: 'all',
  update: 'all',
  delete: 'none',
});

const readOwnWriteOwn = (): EntityCrudPermissions => ({
  read: 'own',
  create: 'own',
  update: 'own',
  delete: 'own',
});

const readOwnUpdateOwn = (): EntityCrudPermissions => ({
  read: 'own',
  create: 'none',
  update: 'own',
  delete: 'none',
});

const noneAccess = (): EntityCrudPermissions => ({
  read: 'none',
  create: 'none',
  update: 'none',
  delete: 'none',
});

export const ENTITY_PERMISSIONS: EntityPermissionsMatrix = {
  User: {
    admin: fullAccess(),
    teacher: noneAccess(),
    student: noneAccess(),
  },
  Student: {
    admin: fullAccess(),
    teacher: readOwnUpdateOwn(),
    student: {
      read: 'own',
      create: 'none',
      update: 'own',
      delete: 'none',
    },
  },
  Teacher: {
    admin: fullAccess(),
    teacher: {
      read: 'own',
      create: 'none',
      update: 'own',
      delete: 'none',
    },
    student: readAll(),
  },
  Lesson: {
    admin: fullAccess(),
    teacher: readOwnWriteOwn(),
    student: {
      read: 'own',
      create: 'none',
      update: 'none',
      delete: 'none',
    },
  },
  Payment: {
    admin: fullAccess(),
    teacher: readOwn(),
    student: {
      read: 'own',
      create: 'none',
      update: 'none',
      delete: 'none',
    },
  },
  Course: {
    admin: fullAccess(),
    teacher: readAllWriteAll(),
    student: {
      read: 'own',
      create: 'none',
      update: 'none',
      delete: 'none',
    },
  },
  LessonMaterial: {
    admin: fullAccess(),
    teacher: readAllWriteAll(),
    student: readAll(),
  },
  ScheduleSlot: {
    admin: fullAccess(),
    teacher: readOwnWriteOwn(),
    student: readAll(),
  },
  LessonStudent: {
    admin: fullAccess(),
    teacher: fullAccess(),
    student: {
      read: 'own',
      create: 'none',
      update: 'none',
      delete: 'none',
    },
  },
  TeacherPayment: {
    admin: fullAccess(),
    teacher: {
      read: 'own',
      create: 'none',
      update: 'none',
      delete: 'none',
    },
    student: noneAccess(),
  },
  MaterialAccess: {
    admin: fullAccess(),
    teacher: readAllWriteAll(),
    student: {
      read: 'own',
      create: 'none',
      update: 'none',
      delete: 'none',
    },
  },
  TeacherAvailability: {
    admin: fullAccess(),
    teacher: {
      read: 'own',
      create: 'all',
      update: 'own',
      delete: 'own',
    },
    student: noneAccess(),
  },
  AppSettings: {
    admin: fullAccess(),
    teacher: readAll(),
    student: noneAccess(),
  },
  ShopSettings: {
    admin: fullAccess(),
    teacher: readAll(),
    student: readAll(),
  },
  WelcomePageSettings: {
    admin: fullAccess(),
    teacher: readAll(),
    student: readAll(),
  },
};

const PENDING_PERMISSIONS: EntityCrudPermissions = noneAccess();

export function getEntityPermissions(
  entity: EntityName,
  role: NormalizedRole,
): EntityCrudPermissions {
  if (role === 'pending') {
    return PENDING_PERMISSIONS;
  }
  return ENTITY_PERMISSIONS[entity][role];
}

export function getActionScope(
  entity: EntityName,
  role: NormalizedRole,
  action: CrudAction,
): AccessScope {
  return getEntityPermissions(entity, role)[action];
}
