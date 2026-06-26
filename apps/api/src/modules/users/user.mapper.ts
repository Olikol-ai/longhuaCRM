import { UserEntity } from '../../entities/user.entity';
import { recordFromEntity } from '../../common/utils/record.util';

export function userToRecord(row: UserEntity): Record<string, unknown> {
  const fullName =
    row.firstName && row.lastName ? `${row.lastName} ${row.firstName}` : row.email;
  return {
    id: row.id,
    email: row.email,
    role: row.role || 'pending',
    first_name: row.firstName || '',
    last_name: row.lastName || '',
    phone: row.phone || '',
    telegram_id: row.telegramId || '',
    full_name: fullName,
    created_date: row.createdDate.toISOString(),
    updated_date: row.updatedDate.toISOString(),
  };
}

export function recordToUser(row: UserEntity): Record<string, unknown> {
  return userToRecord(row);
}
