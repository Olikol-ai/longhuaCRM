import { AuditLogEntity } from './audit-log.entity';
import { TeacherAvailabilitySlotEntity } from './teacher-availability-slot.entity';
import { LessonMaterialLinkEntity } from './lesson-material-link.entity';
import { LessonMaterialTagEntity } from './lesson-material-tag.entity';
import { LessonSeriesStudentEntity } from './lesson-series-student.entity';
import { LessonSeriesExclusionEntity } from './lesson-series-exclusion.entity';
import { PendingRegistrationEntity } from './pending-registration.entity';
import { UserEntity } from './user.entity';
import {
  StudentEntity,
  TeacherEntity,
  LessonEntity,
  PaymentEntity,
  CourseEntity,
  CourseFolderEntity,
  LessonMaterialEntity,
  ScheduleSlotEntity,
  LessonStudentEntity,
  LessonBalanceEntity,
  TeacherPaymentEntity,
  MaterialAccessEntity,
  TeacherAvailabilityEntity,
  TeacherAvailabilityBookingEntity,
  LessonSeriesEntity,
  AlfaBankOrderEntity,
  AppSettingEntity,
  ShopItemEntity,
  WelcomePageSettingEntity,
} from './crm.entities';

export * from './pending-registration.entity';
export * from './user.entity';
export * from './crm.entities';

export const ALL_ENTITIES = [
  AuditLogEntity,
  PendingRegistrationEntity,
  UserEntity,
  StudentEntity,
  TeacherEntity,
  LessonEntity,
  PaymentEntity,
  CourseEntity,
  CourseFolderEntity,
  LessonMaterialEntity,
  ScheduleSlotEntity,
  LessonStudentEntity,
  LessonBalanceEntity,
  TeacherPaymentEntity,
  MaterialAccessEntity,
  TeacherAvailabilityEntity,
  TeacherAvailabilityBookingEntity,
  LessonSeriesEntity,
  AlfaBankOrderEntity,
  AppSettingEntity,
  ShopItemEntity,
  WelcomePageSettingEntity,
  TeacherAvailabilitySlotEntity,
  LessonSeriesStudentEntity,
  LessonSeriesExclusionEntity,
  LessonMaterialLinkEntity,
  LessonMaterialTagEntity,
];
