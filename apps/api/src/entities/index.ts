import { AuditLogEntity } from './AuditLog.entity';
import { UserEntity } from './user.entity';
import {
  StudentEntity,
  TeacherEntity,
  LessonEntity,
  PaymentEntity,
  CourseEntity,
  LessonMaterialEntity,
  ScheduleSlotEntity,
  LessonStudentEntity,
  LessonBalanceEntity,
  TeacherPaymentEntity,
  MaterialAccessEntity,
  TeacherAvailabilityEntity,
  AlfaBankOrderEntity,
  AppSettingEntity,
  ShopItemEntity,
  WelcomePageSettingEntity,
} from './crm.entities';

export * from './user.entity';
export * from './crm.entities';

export const ALL_ENTITIES = [
  AuditLogEntity,
  UserEntity,
  StudentEntity,
  TeacherEntity,
  LessonEntity,
  PaymentEntity,
  CourseEntity,
  LessonMaterialEntity,
  ScheduleSlotEntity,
  LessonStudentEntity,
  LessonBalanceEntity,
  TeacherPaymentEntity,
  MaterialAccessEntity,
  TeacherAvailabilityEntity,
  AlfaBankOrderEntity,
  AppSettingEntity,
  ShopItemEntity,
  WelcomePageSettingEntity,
];
