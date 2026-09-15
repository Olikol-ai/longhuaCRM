import { PendingRegistrationEntity } from '../auth/entities/pending-registration.entity';

export function pendingRegistrationToRegistryItem(
  row: PendingRegistrationEntity,
): Record<string, unknown> {
  const fullName =
    row.firstName && row.lastName
      ? `${row.lastName} ${row.firstName}`.trim()
      : row.email;
  return {
    id: row.id,
    entry_type: 'pending_registration',
    email: row.email,
    role: null,
    account_role: 'registration',
    status: row.status === 'blocked' ? 'blocked' : 'pending',
    account_status: 'pending_registration',
    display_status: 'pending_registration',
    onboarding_state: 'needs_verification',
    first_name: row.firstName || '',
    last_name: row.lastName || '',
    phone: row.phone || '',
    full_name: fullName,
    created_date: row.createdDate.toISOString(),
    updated_date: row.updatedDate.toISOString(),
    has_account: false,
    deletable: true,
    assigned_teacher_id: row.inviteTeacherId,
    assigned_teacher_name: '',
    wants_student_role: row.wantsStudentRole,
  };
}
