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
  ShopSettingEntity,
  WelcomePageSettingEntity,
} from './crm.entities';

export * from './user.entity';
export * from './json-record.entity';
export * from './crm.entities';

export const ALL_ENTITIES = [
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
  ShopSettingEntity,
  WelcomePageSettingEntity,
];
