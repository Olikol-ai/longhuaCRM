import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import {
  CRM_ENTITY_CLASS_MAP,
  CrmEntityName,
  isGenericEntityName,
  STUDENT_BALANCE_BLOCKED_FIELDS,
  USER_BLOCKED_UPDATE_FIELDS,
} from '../../common/constants/entity-registry';
import { EntityName } from '../../common/constants/entity-names';
import { normalizeRole } from '../../common/constants/roles';
import {
  entityToRecord,
  matchesFilter,
  recordToEntityPayload,
  sortRecords,
} from '../../common/utils/record.util';
import { PaymentEntity } from '../../entities/Payment.entity';
import { ShopItemEntity } from '../../entities/ShopItem.entity';
import { WelcomePageSettingEntity } from '../../entities/WelcomePageSetting.entity';
import { paymentToRecord } from '../payments/payment.mapper';
import { PaymentService } from '../payments/payment.service';
import { recordToShopItemPayload, shopItemToRecord } from '../shop/shop.mapper';
import { welcomeInputToRows, welcomeRowsToRecord } from '../welcome/welcome.mapper';
import { StudentBalanceService } from '../students/student-balance.service';
import { UsersRepository } from '../users/users.repository';
import { EntityAccessService } from './entity-access.service';
import { EntityAccessContext } from './entity-access.types';

@Injectable()
export class EntityRepositoryService {
  private readonly repoMap = new Map<CrmEntityName, Repository<any>>();

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly usersRepository: UsersRepository,
    private readonly entityAccess: EntityAccessService,
    private readonly paymentService: PaymentService,
    private readonly studentBalanceService: StudentBalanceService,
  ) {}

  isKnownEntity(entity: string): entity is EntityName {
    return isGenericEntityName(entity);
  }

  getSystemContext(): EntityAccessContext {
    return this.entityAccess.createSystemContext();
  }

  private assertNotGenericUser(entity: EntityName): void {
    if (entity === 'User') {
      throw new ForbiddenException('Use /api/users for User management');
    }
  }

  async list(
    entity: EntityName,
    context: EntityAccessContext | null,
    sortField?: string,
    limit?: number,
  ) {
    if (context) {
      this.entityAccess.assertCan(entity, 'read', context);
    }

    this.assertNotGenericUser(entity);

    let records: Record<string, unknown>[];

    const repo = this.getRepo(entity as CrmEntityName);
    const rows = await repo.find();
    if (entity === 'WelcomePageSettings') {
      const aggregated = welcomeRowsToRecord(rows as WelcomePageSettingEntity[]);
      records = aggregated ? [aggregated] : [];
    } else {
      records =
        entity === 'Payment'
          ? rows.map((row) => paymentToRecord(row as PaymentEntity))
          : entity === 'ShopSettings'
            ? rows.map((row) => shopItemToRecord(row as ShopItemEntity))
            : rows.map((row) => entityToRecord(row as Record<string, unknown>));
    }

    if (context) {
      records = this.entityAccess.filterReadableRecords(entity, context, records);
    }

    return this.applySortAndLimit(records, sortField, limit);
  }

  private applySortAndLimit(
    records: Record<string, unknown>[],
    sortField?: string,
    limit?: number,
  ) {
    let result = sortRecords(records, sortField);

    if (limit) {
      result = result.slice(0, limit);
    }

    return result;
  }

  async filter(
    entity: EntityName,
    query: Record<string, unknown>,
    context: EntityAccessContext,
  ) {
    const list = await this.list(entity, context);
    return list.filter((record) => matchesFilter(record, query));
  }

  async getById(entity: EntityName, id: string, context: EntityAccessContext) {
    this.entityAccess.assertCan(entity, 'read', context);
    this.assertNotGenericUser(entity);

    const repo = this.getRepo(entity as CrmEntityName);
    const row = await repo.findOne({ where: { id } });

    if (!row) return null;

    const record =
      entity === 'Payment'
        ? paymentToRecord(row as PaymentEntity)
        : entity === 'ShopSettings'
          ? shopItemToRecord(row as ShopItemEntity)
          : entityToRecord(row as Record<string, unknown>);
    this.entityAccess.assertCanAccessRecord(entity, 'read', context, record);
    return record;
  }

  async create(
    entity: EntityName,
    input: Record<string, unknown>,
    context: EntityAccessContext,
  ) {
    this.assertNotGenericUser(entity);
    this.entityAccess.assertCanCreatePayload(entity, context, input);
    this.assertNoSensitiveFields(entity, input, context);

    if (entity === 'Payment') {
      return this.paymentService.create(input);
    }

    if (entity === 'ShopSettings') {
      const repo = this.getRepo(entity as CrmEntityName);
      const now = new Date();
      const id = input.id ? String(input.id) : randomUUID();
      const row = repo.create({
        id,
        ...recordToShopItemPayload(input),
        createdDate: now,
        updatedDate: now,
      });
      const saved = await repo.save(row);
      return shopItemToRecord(saved as ShopItemEntity);
    }

    if (entity === 'WelcomePageSettings') {
      return this.upsertWelcomePageSettings(input);
    }

    const repo = this.getRepo(entity as CrmEntityName);
    const now = new Date();
    const id = input.id ? String(input.id) : randomUUID();
    const payload = recordToEntityPayload(input);

    const row = repo.create({
      id,
      ...payload,
      createdDate: now,
      updatedDate: now,
    });

    const saved = await repo.save(row);
    return entityToRecord(saved as Record<string, unknown>);
  }

  async update(
    entity: EntityName,
    id: string,
    input: Record<string, unknown>,
    context: EntityAccessContext,
  ) {
    this.assertNotGenericUser(entity);
    this.entityAccess.assertCan(entity, 'update', context);
    this.assertNoSensitiveFields(entity, input, context);

    if (entity === 'WelcomePageSettings') {
      return this.upsertWelcomePageSettings(input);
    }

    const repo = this.getRepo(entity as CrmEntityName);
    const row = await repo.findOne({ where: { id } });

    if (!row) throw new NotFoundException(`${entity} not found`);

    const currentRecord =
      entity === 'Payment'
        ? paymentToRecord(row as PaymentEntity)
        : entity === 'ShopSettings'
          ? shopItemToRecord(row as ShopItemEntity)
          : entityToRecord(row as Record<string, unknown>);
    this.entityAccess.assertCanAccessRecord(entity, 'update', context, currentRecord);
    this.assertNoSensitiveFields(entity, input, context);

    if (entity === 'Payment') {
      return this.paymentService.update(id, input);
    }

    const payload = recordToEntityPayload(input);

    if (entity === 'ShopSettings') {
      Object.assign(row, recordToShopItemPayload(input));
      (row as { updatedDate: Date }).updatedDate = new Date();
      const saved = await repo.save(row);
      return shopItemToRecord(saved as ShopItemEntity);
    }

    if (entity === 'Lesson' && input.status !== undefined) {
      Object.assign(row, payload);
      (row as { updatedDate: Date }).updatedDate = new Date();
      const saved = await repo.save(row);
      await this.studentBalanceService.handleLessonStatusUpdate(id, String(input.status));
      const refreshed = await repo.findOne({ where: { id } });
      return entityToRecord(refreshed as Record<string, unknown>);
    }

    Object.assign(row, payload);
    (row as { updatedDate: Date }).updatedDate = new Date();

    const saved = await repo.save(row);
    return entityToRecord(saved as Record<string, unknown>);
  }

  async delete(entity: EntityName, id: string, context: EntityAccessContext) {
    this.assertNotGenericUser(entity);
    this.entityAccess.assertCan(entity, 'delete', context);

    const repo = this.getRepo(entity as CrmEntityName);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`${entity} not found`);

    const currentRecord =
      entity === 'Payment'
        ? paymentToRecord(row as PaymentEntity)
        : entity === 'ShopSettings'
          ? shopItemToRecord(row as ShopItemEntity)
          : entityToRecord(row as Record<string, unknown>);
    this.entityAccess.assertCanAccessRecord(entity, 'delete', context, currentRecord);

    if (entity === 'Payment') {
      await this.paymentService.delete(id);
      return;
    }

    return repo.delete({ id });
  }

  async bulkCreate(
    entity: EntityName,
    items: Record<string, unknown>[],
    context: EntityAccessContext,
  ) {
    const results: Record<string, unknown>[] = [];

    for (const item of items) {
      results.push(await this.create(entity, item, context));
    }

    return results;
  }

  async deleteRecordById(id: string) {
    for (const entity of Object.keys(CRM_ENTITY_CLASS_MAP) as CrmEntityName[]) {
      const repo = this.getRepo(entity);
      const res = await repo.delete({ id });
      if (res.affected) return;
    }

    await this.usersRepository.delete(id);
  }

  private assertNoSensitiveFields(
    entity: EntityName,
    input: Record<string, unknown>,
    context: EntityAccessContext,
  ) {
    const isSystem = context.userId === 'system';
    const isAdmin = normalizeRole(context.role) === 'admin' || isSystem;

    for (const key of Object.keys(input)) {
      if (!isAdmin && USER_BLOCKED_UPDATE_FIELDS.has(key)) {
        throw new ForbiddenException(`Field "${key}" cannot be updated without admin role`);
      }

      if (
        entity === 'Student' &&
        !isAdmin &&
        STUDENT_BALANCE_BLOCKED_FIELDS.has(key)
      ) {
        throw new ForbiddenException(
          'lesson_balance can only be changed through payments or by an administrator',
        );
      }
    }
  }

  private async upsertWelcomePageSettings(
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const repo = this.getRepo('WelcomePageSettings');
    const now = new Date();

    for (const partial of welcomeInputToRows(input)) {
      const existing = await repo.findOne({
        where: { key: partial.key as string },
      });

      if (existing) {
        existing.value = partial.value as string;
        existing.updatedDate = now;
        await repo.save(existing);
      } else {
        await repo.save(
          repo.create({
            id: randomUUID(),
            key: partial.key as string,
            value: partial.value as string,
            description: partial.description as string,
            type: partial.type as string,
            isActive: true,
            createdDate: now,
            updatedDate: now,
          }),
        );
      }
    }

    const rows = await repo.find();
    const aggregated = welcomeRowsToRecord(rows as WelcomePageSettingEntity[]);
    if (!aggregated) {
      throw new NotFoundException('Welcome page settings could not be saved');
    }
    return aggregated;
  }

  private getRepo(entity: CrmEntityName): Repository<any> {
    let repo = this.repoMap.get(entity);
    if (!repo) {
      repo = this.dataSource.getRepository(CRM_ENTITY_CLASS_MAP[entity]);
      this.repoMap.set(entity, repo);
    }
    return repo;
  }
}

export { CRM_ENTITY_CLASS_MAP as ENTITY_CLASS_MAP };
