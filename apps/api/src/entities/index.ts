import { AuditLogEntity } from './AuditLog.entity';
import { TeacherAvailabilitySlotEntity } from './TeacherAvailabilitySlot.entity';
import { LessonMaterialLinkEntity } from './LessonMaterialLink.entity';
import { LessonMaterialTagEntity } from './LessonMaterialTag.entity';
import { LessonSeriesStudentEntity } from './LessonSeriesStudent.entity';
import { LessonSeriesExclusionEntity } from './LessonSeriesExclusion.entity';
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
