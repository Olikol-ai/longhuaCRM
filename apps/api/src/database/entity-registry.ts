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
import { LessonRecurrenceSeriesEntity } from '../modules/lessons/entities/lesson-recurrence-series.entity';
import { LessonRecurrenceExceptionEntity } from '../modules/lessons/entities/lesson-recurrence-exception.entity';
import { LessonStudentChangeHistoryEntity } from '../modules/lessons/entities/lesson-student-change-history.entity';
import { MaterialAccessEntity } from '../modules/materials/entities/material-access.entity';
import { MaterialCourseGrantEntity } from '../modules/materials/entities/material-course-grant.entity';
import { MaterialGroupGrantEntity } from '../modules/materials/entities/material-group-grant.entity';
import { MaterialFolderEntity } from '../modules/materials/entities/material-folder.entity';
import { MaterialLinkEntity } from '../modules/materials/entities/material-link.entity';
import { MaterialEntity } from '../modules/materials/entities/material.entity';
import { NotificationEntity } from '../modules/notifications/entities/notification.entity';
import { PushSubscriptionEntity } from '../modules/notifications/entities/push-subscription.entity';
import { NotificationPreferenceEntity } from '../modules/notifications/entities/notification-preference.entity';
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
import { TutorEntity } from '../modules/tutors/entities/tutor.entity';
import { TutorStudentEntity } from '../modules/tutors/entities/tutor-student.entity';
import { TutorLearningDirectionEntity } from '../modules/tutors/entities/tutor-learning-direction.entity';
import { TutorTeachingLanguageEntity } from '../modules/tutors/entities/tutor-teaching-language.entity';
import { TutorLessonDurationEntity } from '../modules/tutors/entities/tutor-lesson-duration.entity';
import { TutorWorkDayEntity } from '../modules/tutors/entities/tutor-work-day.entity';
import { TutorMaterialEntity } from '../modules/tutors/entities/tutor-material.entity';
import { TeacherStudentContactEntity } from '../modules/teacher-student-contacts/entities/teacher-student-contact.entity';
import { TeacherStudentBalanceHistoryEntity } from '../modules/teacher-student-contacts/entities/teacher-student-balance-history.entity';
import { TutorContactBalanceEntity } from '../modules/teacher-student-contacts/entities/tutor-contact-balance.entity';
import { TeacherInviteLinkEntity } from '../modules/teachers/entities/teacher-invite-link.entity';
import { TutorInviteLinkEntity } from '../modules/tutors/entities/tutor-invite-link.entity';
import { TeacherMonthlyPayoutEntity } from '../modules/teacher-payments/entities/teacher-monthly-payout.entity';
import { TeacherPaymentEntity } from '../modules/teacher-payments/entities/teacher-payment.entity';
import { AppSettingEntity } from '../modules/settings/entities/app-setting.entity';
import { UserEntity } from '../modules/users/entities/user.entity';
import { LessonConfirmationEntity } from '../modules/lesson-confirmations/entities/lesson-confirmation.entity';
import { InstructorScheduleDigestEntity } from '../modules/lesson-confirmations/entities/instructor-schedule-digest.entity';
import { ASSESSMENT_ENTITIES } from '../modules/assessment/entities';
import { HOMEWORK_ENTITIES } from '../modules/homework/entities';
import { CHAT_ENTITIES } from '../modules/chats/entities';
import { EXAM_ACADEMY_ENTITIES } from '../modules/exam-academy/entities';
import { EXAM_CONTENT_ENTITIES } from '../modules/exam-content/entities';

/** All v2 domain entities for TypeORM registration. */
export const ALL_V2_ENTITIES = [
  UserEntity,
  PendingRegistrationEntity,
  StudentEntity,
  TeacherEntity,
  TutorEntity,
  TutorStudentEntity,
  TutorLearningDirectionEntity,
  TutorTeachingLanguageEntity,
  TutorLessonDurationEntity,
  TutorWorkDayEntity,
  TutorMaterialEntity,
  TeacherStudentContactEntity,
  TeacherStudentBalanceHistoryEntity,
  TutorContactBalanceEntity,
  TeacherInviteLinkEntity,
  TutorInviteLinkEntity,
  CourseTemplateEntity,
  EnrollmentEntity,
  EnrollmentLessonEventEntity,
  GroupEntity,
  GroupMemberEntity,
  LessonEntity,
  LessonRecurrenceSeriesEntity,
  LessonRecurrenceExceptionEntity,
  AttendanceEntity,
  LessonStudentChangeHistoryEntity,
  LessonConfirmationEntity,
  InstructorScheduleDigestEntity,
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
  TeacherMonthlyPayoutEntity,
  NotificationEntity,
  PushSubscriptionEntity,
  NotificationPreferenceEntity,
  AuditLogEntity,
  AppSettingEntity,
  ...ASSESSMENT_ENTITIES,
  ...HOMEWORK_ENTITIES,
  ...CHAT_ENTITIES,
  ...EXAM_ACADEMY_ENTITIES,
  ...EXAM_CONTENT_ENTITIES,
];
