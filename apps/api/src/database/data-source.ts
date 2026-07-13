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
  ],
  synchronize: false,
});
