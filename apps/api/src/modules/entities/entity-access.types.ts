import { NormalizedRole } from '../../common/constants/roles';

export interface EntityAccessContext {
  userId: string;
  role: NormalizedRole;
  ownedStudentIds: string[];
  ownedTeacherId: string | null;
  /** Student IDs assigned to the current teacher profile. */
  assignedStudentIds: string[];
}

export interface OwnershipContext {
  userId: string;
  ownedStudentIds: string[];
  ownedTeacherId: string | null;
  assignedStudentIds: string[];
}
