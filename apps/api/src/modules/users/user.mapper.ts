import { UserEntity } from './entities/user.entity';
import { getOnboardingContext } from '../auth/onboarding';

export function userToRecord(row: UserEntity): Record<string, unknown> {
  const fullName =
    row.firstName && row.lastName ? `${row.lastName} ${row.firstName}` : row.email;
  const onboarding = getOnboardingContext(row);

  return {
    id: row.id,
    email: row.email,
    role: onboarding.role,
    status: onboarding.status,
    onboarding_state: onboarding.onboarding_state,
    redirect_path: onboarding.redirect_path,
    first_name: row.firstName || '',
    last_name: row.lastName || '',
    phone: row.phone || '',
    telegram_id: row.telegramId || '',
    telegram_username: row.telegramUsername || '',
    telegram_connected_at: row.telegramConnectedAt
      ? row.telegramConnectedAt.toISOString()
      : null,
    full_name: fullName,
    created_date: row.createdDate.toISOString(),
    updated_date: row.updatedDate.toISOString(),
  };
}
