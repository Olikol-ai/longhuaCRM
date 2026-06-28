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
  ],
  synchronize: false,
});
