import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from '../entities';
import { InitialSchema1730000000000 } from './migrations/1730000000000-InitialSchema';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ALL_ENTITIES,
  migrations: [InitialSchema1730000000000],
  synchronize: false,
});
