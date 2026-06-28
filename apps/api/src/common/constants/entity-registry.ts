import {
  AlfaBankOrderEntity,
  AppSettingEntity,
  CourseEntity,
  LessonBalanceEntity,
  LessonEntity,
  LessonMaterialEntity,
  LessonStudentEntity,
  MaterialAccessEntity,
  PaymentEntity,
  ScheduleSlotEntity,
  ShopItemEntity,
  StudentEntity,
  TeacherAvailabilityEntity,
  TeacherEntity,
  TeacherPaymentEntity,
  WelcomePageSettingEntity,
} from '../../entities/crm.entities';
import { EntityName, ENTITY_NAMES } from './entity-names';

export const CRM_ENTITY_CLASS_MAP = {
  Student: StudentEntity,
  Teacher: TeacherEntity,
  Lesson: LessonEntity,
  Payment: PaymentEntity,
  Course: CourseEntity,
  LessonMaterial: LessonMaterialEntity,
  ScheduleSlot: ScheduleSlotEntity,
  LessonStudent: LessonStudentEntity,
  LessonBalance: LessonBalanceEntity,
  TeacherPayment: TeacherPaymentEntity,
  MaterialAccess: MaterialAccessEntity,
  TeacherAvailability: TeacherAvailabilityEntity,
  AlfaBankOrder: AlfaBankOrderEntity,
  AppSettings: AppSettingEntity,
  ShopSettings: ShopItemEntity,
  WelcomePageSettings: WelcomePageSettingEntity,
} as const;

export type CrmEntityName = keyof typeof CRM_ENTITY_CLASS_MAP;

export const CRM_ENTITY_CLASSES = Object.values(CRM_ENTITY_CLASS_MAP);

export const USER_BLOCKED_UPDATE_FIELDS = new Set([
  'id',
  'password_hash',
  'passwordHash',
  'email',
  'created_date',
  'updated_date',
  'createdDate',
  'updatedDate',
]);

/** Only admin or PaymentService/StudentBalanceService may change lesson balance. */
export const STUDENT_BALANCE_BLOCKED_FIELDS = new Set([
  'lesson_balance',
  'lessonBalance',
]);

export function isCrmEntityName(name: string): name is CrmEntityName {
  return (ENTITY_NAMES as readonly string[]).includes(name);
}

export function isGenericEntityName(name: string): name is EntityName {
  return name === 'User' || isCrmEntityName(name);
}
