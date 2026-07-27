import { JwtPayload } from '../../modules/auth/auth.service';

export type DomainAccessActor = JwtPayload;

export const STUDENT_SELF_UPDATE_FIELDS = [
  'telegramId',
  'birthday',
  'phone',
  'firstName',
  'lastName',
  'name',
] as const;

export const TEACHER_SELF_UPDATE_FIELDS = [
  'telegramId',
  'phone',
  'firstName',
  'lastName',
  'name',
  'userId',
] as const;

export const TUTOR_SELF_UPDATE_FIELDS = [
  'displayName',
  'bio',
  'specializations',
  'phone',
] as const;

export const TEACHER_LESSON_UPDATE_FIELDS = [
  'status',
  'completionAttendance',
  'notes',
  'meetingLink',
  'room',
  'date',
  'startTime',
  'duration',
] as const;
