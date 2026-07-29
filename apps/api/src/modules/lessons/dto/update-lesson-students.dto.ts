import { Transform } from 'class-transformer';
import { IsOptional, IsUUID } from 'class-validator';

function pickUuid(...candidates: unknown[]): string | undefined {
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

/**
 * Dedicated student-reassignment payload.
 * Exactly one of the three target ids must be set (enforced in LessonsService).
 */
export class UpdateLessonStudentsDto {
  @IsOptional()
  @Transform(({ value, obj }) => {
    const record = obj as Record<string, unknown>;
    return pickUuid(value, record.studentId, record.student_id);
  })
  @IsUUID()
  student_id?: string;

  @IsOptional()
  @Transform(({ value, obj }) => {
    const record = obj as Record<string, unknown>;
    return pickUuid(
      value,
      record.tutorStudentId,
      record.tutor_student_id,
      record.primaryTutorStudentId,
      record.primary_tutor_student_id,
    );
  })
  @IsUUID()
  tutor_student_id?: string;

  @IsOptional()
  @Transform(({ value, obj }) => {
    const record = obj as Record<string, unknown>;
    return pickUuid(
      value,
      record.teacherStudentContactId,
      record.teacher_student_contact_id,
      record.primaryTeacherStudentContactId,
      record.primary_teacher_student_contact_id,
    );
  })
  @IsUUID()
  teacher_student_contact_id?: string;
}
