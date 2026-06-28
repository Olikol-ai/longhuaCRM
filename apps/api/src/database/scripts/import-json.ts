import 'reflect-metadata';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import dataSource from '../data-source';
import { CRM_ENTITY_CLASS_MAP } from '../../common/constants/entity-registry';
import { recordToEntityPayload } from '../../common/utils/record.util';
import { UserEntity } from '../../entities/user.entity';

const ENTITY_REPO_MAP = CRM_ENTITY_CLASS_MAP;

async function importJson() {
  const jsonPath =
    process.argv[2] ||
    process.env.IMPORT_JSON_PATH ||
    path.join(__dirname, '../../../../server/data/database.json');

  if (!fs.existsSync(jsonPath)) {
    console.error(`JSON file not found: ${jsonPath}`);
    process.exit(1);
  }

  const store = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as {
    users?: Array<Record<string, any>>;
    records?: Record<string, Array<Record<string, any>>>;
  };

  await dataSource.initialize();

  // -------------------------
  // USERS IMPORT (UNCHANGED)
  // -------------------------
  const userRepo = dataSource.getRepository(UserEntity);

  for (const user of store.users || []) {
    const existing = await userRepo.findOne({
      where: { email: String(user.email) },
    });

    if (existing) continue;

    await userRepo.save({
      id: String(user.id),
      email: String(user.email),
      passwordHash: String(user.password_hash),
      role: String(user.role || 'pending'),
      firstName: String(user.first_name || ''),
      lastName: String(user.last_name || ''),
      phone: String(user.phone || ''),
      telegramId: String(user.telegram_id || ''),
      createdDate: new Date(
        String(user.created_date || new Date().toISOString()),
      ),
      updatedDate: new Date(
        String(user.updated_date || new Date().toISOString()),
      ),
    });
  }

  // -------------------------
  // GENERIC ENTITIES IMPORT
  // -------------------------
  for (const [entityName, records] of Object.entries(store.records || {})) {
    const EntityClass = ENTITY_REPO_MAP[entityName];

    if (!EntityClass) {
      console.warn(`Skipping unknown entity: ${entityName}`);
      continue;
    }

    const repo = dataSource.getRepository(EntityClass);

    for (const record of records) {
      const id = String(record.id || randomUUID());

      const existing = await repo.findOne({
        where: { id },
      });

      if (existing) continue;

      // clean system fields
      const {
        id: _id,
        created_date,
        updated_date,
        ...payload
      } = record;

      const entityPayload = recordToEntityPayload(payload);

      await repo.save({
        id,
        ...entityPayload,
        createdDate: new Date(
          String(created_date || new Date().toISOString()),
        ),
        updatedDate: new Date(
          String(updated_date || new Date().toISOString()),
        ),
      });
    }
  }

  await dataSource.destroy();

  console.log(`Import completed from ${jsonPath}`);
}

importJson().catch((error) => {
  console.error(error);
  process.exit(1);
});
