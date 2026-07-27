import { formatStudentProfileDisplayName } from './display-name.util';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { TutorEntity } from '../tutors/entities/tutor.entity';
import { UserEntity } from './entities/user.entity';
import { userToRecord } from './user.mapper';

export type DirectoryEntryType =
  | 'account'
  | 'student_profile'
  | 'teacher_profile'
  | 'tutor_profile';

export function userToDirectoryEntry(
  user: UserEntity,
  student: StudentEntity | null,
  teacher: TeacherEntity | null,
  tutor: TutorEntity | null = null,
): Record<string, unknown> {
  const base = userToRecord(user);

  // Student.name is SSOT for student-facing directory labels.
  if (student) {
    const display = formatStudentProfileDisplayName(student);
    return {
      ...base,
      first_name: student.firstName ?? base.first_name,
      last_name: student.lastName ?? base.last_name,
      full_name: display || base.full_name,
      entry_type: 'account' as DirectoryEntryType,
      has_account: true,
      user_id: user.id,
      student_profile_id: student.id,
      teacher_profile_id: teacher?.id ?? null,
      tutor_profile_id: tutor?.id ?? null,
    };
  }

  if (teacher) {
    const display = String(teacher.name ?? '').trim();
    return {
      ...base,
      first_name: teacher.firstName ?? base.first_name,
      last_name: teacher.lastName ?? base.last_name,
      full_name: display || base.full_name,
      entry_type: 'account' as DirectoryEntryType,
      has_account: true,
      user_id: user.id,
      student_profile_id: null,
      teacher_profile_id: teacher.id,
      tutor_profile_id: null,
    };
  }

  if (tutor) {
    const display = String(tutor.displayName ?? '').trim();
    return {
      ...base,
      full_name: display || base.full_name,
      entry_type: 'account' as DirectoryEntryType,
      has_account: true,
      user_id: user.id,
      student_profile_id: null,
      teacher_profile_id: null,
      tutor_profile_id: tutor.id,
    };
  }

  return {
    ...base,
    entry_type: 'account' as DirectoryEntryType,
    has_account: true,
    user_id: user.id,
    student_profile_id: null,
    teacher_profile_id: null,
    tutor_profile_id: null,
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
    tutor_profile_id: null,
    email: student.email ?? '',
    role: 'student',
    status: student.status,
    first_name: student.firstName ?? '',
    last_name: student.lastName ?? '',
    full_name: formatStudentProfileDisplayName(student) || student.name,
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
    tutor_profile_id: null,
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

export function tutorProfileToDirectoryEntry(tutor: TutorEntity): Record<string, unknown> {
  return {
    id: tutor.id,
    entry_type: 'tutor_profile' as DirectoryEntryType,
    has_account: false,
    user_id: null,
    student_profile_id: null,
    teacher_profile_id: null,
    tutor_profile_id: tutor.id,
    email: tutor.email ?? '',
    role: 'tutor',
    status: tutor.status,
    full_name: tutor.displayName,
    phone: tutor.phone ?? '',
    created_date: tutor.createdAt?.toISOString() ?? null,
    updated_date: tutor.updatedAt?.toISOString() ?? null,
  };
}
