import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from '../entities';
import { getDatabaseDataSourceOptions } from './database.config';
import { InitialSchema1730000000000 } from './migrations/1730000000000-InitialSchema';
import { RelationalSchema1730000000001 } from './migrations/1730000000001-RelationalSchema';
import { MigrateJsonbData1730000000002 } from './migrations/1730000000002-MigrateJsonbData';
import { DropJsonbColumn1730000000003 } from './migrations/1730000000003-DropJsonbColumn';
import { PaymentContractFields1730000000004 } from './migrations/1730000000004-PaymentContractFields';
import { ShopItemsTable1730000000005 } from './migrations/1730000000005-ShopItemsTable';
import { UserOnboardingFields1730000000006 } from './migrations/1730000000006-UserOnboardingFields';
import { NormalizeUserRoles1730000000007 } from './migrations/1730000000007-NormalizeUserRoles';
import { SecurityHardening1730000000008 } from './migrations/1730000000008-SecurityHardening';
import { PaymentAndLessonStudentConstraints1730000000009 } from './migrations/1730000000009-PaymentAndLessonStudentConstraints';
import { EliminateJsonbAndArrays1730000000010 } from './migrations/1730000000010-EliminateJsonbAndArrays';

export default new DataSource({
  ...getDatabaseDataSourceOptions(),
  entities: ALL_ENTITIES,
  migrations: [
    InitialSchema1730000000000,
    RelationalSchema1730000000001,
    MigrateJsonbData1730000000002,
    DropJsonbColumn1730000000003,
    PaymentContractFields1730000000004,
    ShopItemsTable1730000000005,
    UserOnboardingFields1730000000006,
    NormalizeUserRoles1730000000007,
    SecurityHardening1730000000008,
    PaymentAndLessonStudentConstraints1730000000009,
    EliminateJsonbAndArrays1730000000010,
  ],
  synchronize: false,
});
