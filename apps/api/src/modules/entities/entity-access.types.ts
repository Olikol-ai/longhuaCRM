import { NormalizedRole } from '../../common/constants/roles';

export interface EntityAccessContext {
  userId: string;
  role: NormalizedRole;
  ownedStudentIds: string[];
  ownedTeacherId: string | null;
}

export interface OwnershipContext {
  userId: string;
  ownedStudentIds: string[];
  ownedTeacherId: string | null;
}
