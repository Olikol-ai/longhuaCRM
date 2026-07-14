import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { UserEntity } from './entities/user.entity';
import { userToRecord } from './user.mapper';

export type DirectoryEntryType = 'account' | 'student_profile' | 'teacher_profile';

export function userToDirectoryEntry(
  user: UserEntity,
  student: StudentEntity | null,
  teacher: TeacherEntity | null,
): Record<string, unknown> {
  return {
    ...userToRecord(user),
    entry_type: 'account' as DirectoryEntryType,
    has_account: true,
    user_id: user.id,
    student_profile_id: student?.id ?? null,
    teacher_profile_id: teacher?.id ?? null,
  };
}

export function studentProfileToDirectoryEntry(student: StudentEntity): Record<string, unknown> {
  return {
    id: student.id,
    entry_type: 'student_profile' as DirectoryEntryType,
    has_account: false,
    user_id: null,
    student_profile_id: student.id,
    teacher_profile_id: null,
    email: student.email ?? '',
    role: 'student',
    status: student.status,
    first_name: student.firstName ?? '',
    last_name: student.lastName ?? '',
    full_name: student.name,
    phone: student.phone ?? '',
    telegram_id: student.telegramId ?? '',
    telegram_username: student.telegramUsername ?? '',
    telegram_connected_at: student.telegramConnectedAt?.toISOString() ?? null,
    created_date: student.createdAt?.toISOString() ?? null,
    updated_date: student.updatedAt?.toISOString() ?? null,
  };
}

export function teacherProfileToDirectoryEntry(teacher: TeacherEntity): Record<string, unknown> {
  return {
    id: teacher.id,
    entry_type: 'teacher_profile' as DirectoryEntryType,
    has_account: false,
    user_id: null,
    student_profile_id: null,
    teacher_profile_id: teacher.id,
    email: teacher.email ?? '',
    role: 'teacher',
    status: teacher.status,
    first_name: teacher.firstName ?? '',
    last_name: teacher.lastName ?? '',
    full_name: teacher.name,
    phone: teacher.phone ?? '',
    telegram_id: teacher.telegramId ?? '',
    created_date: teacher.createdAt?.toISOString() ?? null,
    updated_date: teacher.updatedAt?.toISOString() ?? null,
  };
}
