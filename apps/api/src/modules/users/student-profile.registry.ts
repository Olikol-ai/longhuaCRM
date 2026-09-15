import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { formatStudentProfileDisplayName } from './display-name.util';

export function studentProfileToRegistryItem(
  student: StudentEntity,
  teacher?: TeacherEntity | null,
): Record<string, unknown> {
  const fullName = formatStudentProfileDisplayName(student) || student.name;
  return {
    id: student.id,
    entry_type: 'student_profile',
    email: student.email ?? null,
    phone: student.phone ?? null,
    role: 'student',
    account_role: 'student',
    account_status: 'no_account',
    display_status: 'no_account',
    onboarding_state: null,
    first_name: student.firstName ?? '',
    last_name: student.lastName ?? '',
    full_name: fullName,
    created_date: student.createdAt?.toISOString() ?? null,
    updated_date: student.updatedAt?.toISOString() ?? null,
    has_account: false,
    deletable: true,
    mergeable: false,
    student_profile_id: student.id,
    lesson_balance: student.lessonBalance,
    assigned_teacher_id: student.assignedTeacherId,
    assigned_teacher_name: teacher?.name ?? '',
    student_status: student.status,
  };
}
