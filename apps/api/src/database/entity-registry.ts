import { PendingRegistrationEntity } from '../modules/auth/entities/pending-registration.entity';
import { AuditLogEntity } from '../modules/audit/entities/audit-log.entity';
import { CertificateEntity } from '../modules/certificates/entities/certificate.entity';
import { CertificateHistoryEntity } from '../modules/certificates/entities/certificate-history.entity';
import { CourseTemplateEntity } from '../modules/courses/entities/course-template.entity';
import { EnrollmentEntity } from '../modules/courses/entities/enrollment.entity';
import { EnrollmentLessonEventEntity } from '../modules/courses/entities/enrollment-lesson-event.entity';
import { GroupEntity } from '../modules/groups/entities/group.entity';
import { GroupMemberEntity } from '../modules/groups/entities/group-member.entity';
import { AttendanceEntity } from '../modules/lessons/entities/attendance.entity';
import { LessonEntity } from '../modules/lessons/entities/lesson.entity';
import { MaterialAccessEntity } from '../modules/materials/entities/material-access.entity';
import { MaterialCourseGrantEntity } from '../modules/materials/entities/material-course-grant.entity';
import { MaterialGroupGrantEntity } from '../modules/materials/entities/material-group-grant.entity';
import { MaterialFolderEntity } from '../modules/materials/entities/material-folder.entity';
import { MaterialLinkEntity } from '../modules/materials/entities/material-link.entity';
import { MaterialEntity } from '../modules/materials/entities/material.entity';
import { NotificationEntity } from '../modules/notifications/entities/notification.entity';
import { PaymentEntity } from '../modules/payments/entities/payment.entity';
import { ShopItemEntity } from '../modules/payments/entities/shop-item.entity';
import { AvailabilityBookingEntity } from '../modules/schedule/entities/availability-booking.entity';
import { AvailabilitySlotEntity } from '../modules/schedule/entities/availability-slot.entity';
import { LessonSeriesEntity } from '../modules/lesson-series/entities/lesson-series.entity';
import { LessonSeriesSlotEntity } from '../modules/lesson-series/entities/lesson-series-slot.entity';
import { SeriesExclusionEntity } from '../modules/schedule/entities/series-exclusion.entity';
import { SeriesStudentEntity } from '../modules/schedule/entities/series-student.entity';
import { StudentEntity } from '../modules/students/entities/student.entity';
import { TeacherEntity } from '../modules/teachers/entities/teacher.entity';
import { TeacherPaymentEntity } from '../modules/teacher-payments/entities/teacher-payment.entity';
import { AppSettingEntity } from '../modules/settings/entities/app-setting.entity';
import { UserEntity } from '../modules/users/entities/user.entity';
import { LessonConfirmationEntity } from '../modules/lesson-confirmations/entities/lesson-confirmation.entity';

/** All v2 domain entities for TypeORM registration. */
export const ALL_V2_ENTITIES = [
  UserEntity,
  PendingRegistrationEntity,
  StudentEntity,
  TeacherEntity,
  CourseTemplateEntity,
  EnrollmentEntity,
  EnrollmentLessonEventEntity,
  GroupEntity,
  GroupMemberEntity,
  LessonEntity,
  AttendanceEntity,
  LessonConfirmationEntity,
  AvailabilitySlotEntity,
  LessonSeriesEntity,
  LessonSeriesSlotEntity,
  SeriesStudentEntity,
  SeriesExclusionEntity,
  AvailabilityBookingEntity,
  PaymentEntity,
  ShopItemEntity,
  MaterialFolderEntity,
  MaterialEntity,
  MaterialAccessEntity,
  MaterialCourseGrantEntity,
  MaterialGroupGrantEntity,
  MaterialLinkEntity,
  CertificateEntity,
  CertificateHistoryEntity,
  TeacherPaymentEntity,
  NotificationEntity,
  AuditLogEntity,
  AppSettingEntity,
];
