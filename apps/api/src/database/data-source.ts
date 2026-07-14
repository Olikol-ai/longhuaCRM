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
  ],
  synchronize: false,
});
