import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ALL_V2_ENTITIES } from './entity-registry';
import { getDatabaseDataSourceOptions } from './database.config';
import { InitialSchemaV21731000000000 } from './migrations/1731000000000-InitialSchemaV2';
import { Phase2BusinessFlow1732000000000 } from './migrations/1732000000000-Phase2BusinessFlow';
import { Phase3ProductionReadiness1733000000000 } from './migrations/1733000000000-Phase3ProductionReadiness';
import { LegacyV2Bridge1734000000000 } from './migrations/1734000000000-LegacyV2Bridge';
import { TeacherPaymentsSchemaAlign1735000000000 } from './migrations/1735000000000-TeacherPaymentsSchemaAlign';
import { SchemaEntityAlign1736000000000 } from './migrations/1736000000000-SchemaEntityAlign';
import { CertificateUniquenessAlign1737000000000 } from './migrations/1737000000000-CertificateUniquenessAlign';
import { IntegrityHardening1738000000000 } from './migrations/1738000000000-IntegrityHardening';
import { TeacherDeletionSetNull1739000000000 } from './migrations/1739000000000-TeacherDeletionSetNull';
import { StudentDeletionSetNull1739100000000 } from './migrations/1739100000000-StudentDeletionSetNull';
import { LessonSeriesSlots1739200000000 } from './migrations/1739200000000-LessonSeriesSlots';
import { MaterialSoftDelete1739300000000 } from './migrations/1739300000000-MaterialSoftDelete';
import { MaterialInheritedGrants1739400000000 } from './migrations/1739400000000-MaterialInheritedGrants';
import { LessonConfirmationsTelegram1739500000000 } from './migrations/1739500000000-LessonConfirmationsTelegram';
import { LessonConfirmation3hRebuild1739600000000 } from './migrations/1739600000000-LessonConfirmation3hRebuild';
import { TelegramDeepLinkAnd24hReminder1739700000000 } from './migrations/1739700000000-TelegramDeepLinkAnd24hReminder';
import { PasswordResetTokens1739800000000 } from './migrations/1739800000000-PasswordResetTokens';
import { DropTelegramPendingInput1739900000000 } from './migrations/1739900000000-DropTelegramPendingInput';
import { TelegramNotifyPreferences1740000000000 } from './migrations/1740000000000-TelegramNotifyPreferences';
import { PendingRegistrationWantsStudent1740100000000 } from './migrations/1740100000000-PendingRegistrationWantsStudent';
import { MaterialCreatedByUser1740200000000 } from './migrations/1740200000000-MaterialCreatedByUser';
import { TeacherInviteLinks1740300000000 } from './migrations/1740300000000-TeacherInviteLinks';
import { CourseTemplateSortOrder1740400000000 } from './migrations/1740400000000-CourseTemplateSortOrder';
import { AssessmentSchema1740500000000 } from './migrations/1740500000000-AssessmentSchema';
import { CertificateAssessmentSource1740600000000 } from './migrations/1740600000000-CertificateAssessmentSource';
import { AssessmentAnswerReviewMeta1740700000000 } from './migrations/1740700000000-AssessmentAnswerReviewMeta';
import { PendingRegistrationInviteLinkId1740800000000 } from './migrations/1740800000000-PendingRegistrationInviteLinkId';
import { LessonRoomColumn1740900000000 } from './migrations/1740900000000-LessonRoomColumn';
import { RepairIndividualLessonAttendance1741000000000 } from './migrations/1741000000000-RepairIndividualLessonAttendance';
import { RepairCompletedIndividualAttendance1741100000000 } from './migrations/1741100000000-RepairCompletedIndividualAttendance';
import { RepairLessonAttendanceData1741200000000 } from './migrations/1741200000000-RepairLessonAttendanceData';
import { RepairStudentUserNameSync1741300000000 } from './migrations/1741300000000-RepairStudentUserNameSync';
import { RepairAttendanceDuplicatesAndConstraints1741400000000 } from './migrations/1741400000000-RepairAttendanceDuplicatesAndConstraints';
import { TeacherMonthlyPayouts1741500000000 } from './migrations/1741500000000-TeacherMonthlyPayouts';
import { RepairOrphanTeacherRelations1741600000000 } from './migrations/1741600000000-RepairOrphanTeacherRelations';
import { TutorFoundation1741700000000 } from './migrations/1741700000000-TutorFoundation';
import { TutorStudentsAndInvites1741800000000 } from './migrations/1741800000000-TutorStudentsAndInvites';
import { HomeworkSchema1741900000000 } from './migrations/1741900000000-HomeworkSchema';
import { LessonVideoFields1742000000000 } from './migrations/1742000000000-LessonVideoFields';
import { StudentPendingAssignmentStatus1742100000000 } from './migrations/1742100000000-StudentPendingAssignmentStatus';
import { TutorProfileAndSettings1742200000000 } from './migrations/1742200000000-TutorProfileAndSettings';
import { TeacherStudentContacts1742300000000 } from './migrations/1742300000000-TeacherStudentContacts';
import { TeacherStudentContactBalance1742400000000 } from './migrations/1742400000000-TeacherStudentContactBalance';
import { TutorMaterialAccess1742500000000 } from './migrations/1742500000000-TutorMaterialAccess';
import { TutorHomeworkOwnership1742600000000 } from './migrations/1742600000000-TutorHomeworkOwnership';

export default new DataSource({
  ...getDatabaseDataSourceOptions(),
  entities: ALL_V2_ENTITIES,
  migrations: [
    InitialSchemaV21731000000000,
    Phase2BusinessFlow1732000000000,
    Phase3ProductionReadiness1733000000000,
    LegacyV2Bridge1734000000000,
    TeacherPaymentsSchemaAlign1735000000000,
    SchemaEntityAlign1736000000000,
    CertificateUniquenessAlign1737000000000,
    IntegrityHardening1738000000000,
    TeacherDeletionSetNull1739000000000,
    StudentDeletionSetNull1739100000000,
    LessonSeriesSlots1739200000000,
    MaterialSoftDelete1739300000000,
    MaterialInheritedGrants1739400000000,
    LessonConfirmationsTelegram1739500000000,
    LessonConfirmation3hRebuild1739600000000,
    TelegramDeepLinkAnd24hReminder1739700000000,
    PasswordResetTokens1739800000000,
    DropTelegramPendingInput1739900000000,
    TelegramNotifyPreferences1740000000000,
    PendingRegistrationWantsStudent1740100000000,
    MaterialCreatedByUser1740200000000,
    TeacherInviteLinks1740300000000,
    CourseTemplateSortOrder1740400000000,
    AssessmentSchema1740500000000,
    CertificateAssessmentSource1740600000000,
    AssessmentAnswerReviewMeta1740700000000,
    PendingRegistrationInviteLinkId1740800000000,
    LessonRoomColumn1740900000000,
    RepairIndividualLessonAttendance1741000000000,
    RepairCompletedIndividualAttendance1741100000000,
    RepairLessonAttendanceData1741200000000,
    RepairStudentUserNameSync1741300000000,
    RepairAttendanceDuplicatesAndConstraints1741400000000,
    TeacherMonthlyPayouts1741500000000,
    RepairOrphanTeacherRelations1741600000000,
    TutorFoundation1741700000000,
    TutorStudentsAndInvites1741800000000,
    HomeworkSchema1741900000000,
    LessonVideoFields1742000000000,
    StudentPendingAssignmentStatus1742100000000,
    TutorProfileAndSettings1742200000000,
    TeacherStudentContacts1742300000000,
    TeacherStudentContactBalance1742400000000,
    TutorMaterialAccess1742500000000,
    TutorHomeworkOwnership1742600000000,
  ],
  synchronize: false,
});
