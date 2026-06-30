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
import { recordToShopItemPayload, shopItemToRecord } from '../shop/shop.mapper';
import { welcomeRowsToRecord } from '../welcome/welcome.mapper';
import { UsersRepository } from '../users/users.repository';
import { EntityAccessService } from './entity-access.service';
import { EntityAccessContext } from './entity-access.types';
import { EntityEnrichmentService } from '../schedule/entity-enrichment.service';
import { MaterialAccessCheckService } from '../entities/material-access-check.service';
import { SecureFilesService } from '../files/secure-files.service';

const GLOBAL_SENSITIVE_FIELDS = new Set([
  'role',
  'status',
  'verification_code',
  'verificationCode',
  'verification_attempts',
  'verificationAttempts',
  'password_hash',
  'passwordHash',
  'telegram_link_token',
  'telegramLinkToken',
  'telegram_link_expires',
  'telegramLinkExpires',
]);

@Injectable()
export class EntityRepositoryService {
  private readonly repoMap = new Map<CrmEntityName, Repository<any>>();

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly usersRepository: UsersRepository,
    private readonly entityAccess: EntityAccessService,
    private readonly enrichment: EntityEnrichmentService,
    private readonly materialAccessCheck: MaterialAccessCheckService,
    private readonly secureFiles: SecureFilesService,
  ) {}

  isKnownEntity(entity: string): entity is EntityName {
    return isGenericEntityName(entity);
  }

  getSystemContext(): EntityAccessContext {
    return this.entityAccess.createSystemContext();
  }

  getRepository(entity: CrmEntityName): Repository<any> {
    return this.getRepo(entity);
  }

  assertCreate(
    entity: EntityName,
    input: Record<string, unknown>,
    context: EntityAccessContext,
  ): void {
    this.assertNotGenericUser(entity);
    this.entityAccess.assertCanCreatePayload(entity, context, input);
    this.assertNoSensitiveFields(entity, input, context);
    this.assertGenericMutationPolicy(entity, 'create', context);
  }

  async assertUpdate(
    entity: EntityName,
    id: string,
    input: Record<string, unknown>,
    context: EntityAccessContext,
  ): Promise<{ row: Record<string, unknown>; currentRecord: Record<string, unknown> }> {
    this.assertNotGenericUser(entity);
    this.entityAccess.assertCan(entity, 'update', context);
    this.assertNoSensitiveFields(entity, input, context);
    this.assertGenericMutationPolicy(entity, 'update', context);

    const row = await this.findRowById(entity as CrmEntityName, id);
    if (!row) {
      throw new NotFoundException(`${entity} not found`);
    }

    const currentRecord = this.toRecord(entity, row);
    this.entityAccess.assertCanAccessRecord(entity, 'update', context, currentRecord);
    this.assertNoSensitiveFields(entity, input, context);

    return { row: row as Record<string, unknown>, currentRecord };
  }

  async assertDelete(
    entity: EntityName,
    id: string,
    context: EntityAccessContext,
  ): Promise<Record<string, unknown>> {
    this.assertNotGenericUser(entity);
    this.entityAccess.assertCan(entity, 'delete', context);
    this.assertGenericMutationPolicy(entity, 'delete', context);

    const row = await this.findRowById(entity as CrmEntityName, id);
    if (!row) {
      throw new NotFoundException(`${entity} not found`);
    }

    const currentRecord = this.toRecord(entity, row);
    this.entityAccess.assertCanAccessRecord(entity, 'delete', context, currentRecord);

    return currentRecord;
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
      records = rows.map((row) => this.toRecord(entity, row));
    }

    records = await this.enrichment.enrich(entity, records);

    if (context) {
      records = this.entityAccess.filterReadableRecords(entity, context, records);
    }

    if (entity === 'LessonMaterial' && context && context.role !== 'admin') {
      records = await this.materialAccessCheck.filterReadableMaterials(context, records);
    }

    if (entity === 'LessonMaterial' && context?.userId && context.userId !== 'system') {
      records = this.secureFiles.maskMaterialFileUrls(
        records,
        context.userId,
        context.role,
      );
    }

    return this.applySortAndLimit(records, sortField, limit);
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

    const row = await this.findRowById(entity as CrmEntityName, id);
    if (!row) return null;

    const record = this.toRecord(entity, row);
    const enriched = (await this.enrichment.enrich(entity, [record]))[0];
    this.entityAccess.assertCanAccessRecord(entity, 'read', context, enriched);

    if (entity === 'LessonMaterial' && context.role !== 'admin') {
      const allowed = await this.materialAccessCheck.canAccessMaterial(
        context.userId,
        id,
        context.role,
      );
      if (!allowed) {
        throw new ForbiddenException('Forbidden: no access to this material');
      }
    }

    if (entity === 'LessonMaterial' && context.userId && context.userId !== 'system') {
      return this.secureFiles.maskMaterialFileUrls(
        [enriched],
        context.userId,
        context.role,
      )[0];
    }

    return enriched;
  }

  async saveGeneric(
    entity: CrmEntityName,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const repo = this.getRepo(entity);
    const now = new Date();
    const id = input.id ? String(input.id) : randomUUID();
    const row = repo.create({
      id,
      ...recordToEntityPayload(input),
      createdDate: now,
      updatedDate: now,
    });
    return repo.save(row);
  }

  async saveShopSettings(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const repo = this.getRepo('ShopSettings');
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

  async updateGeneric(
    entity: CrmEntityName,
    id: string,
    input: Record<string, unknown>,
    row: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const repo = this.getRepo(entity);
    const payload = recordToEntityPayload(input);
    Object.assign(row, payload);
    (row as { updatedDate: Date }).updatedDate = new Date();
    return repo.save(row);
  }

  async updateShopSettings(
    id: string,
    input: Record<string, unknown>,
    row: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    Object.assign(row, recordToShopItemPayload(input));
    (row as { updatedDate: Date }).updatedDate = new Date();
    const saved = await this.getRepo('ShopSettings').save(row);
    return shopItemToRecord(saved as ShopItemEntity);
  }

  async findRowById(entity: CrmEntityName, id: string): Promise<Record<string, unknown> | null> {
    const row = await this.getRepo(entity).findOne({ where: { id } });
    return row ? (row as Record<string, unknown>) : null;
  }

  async deleteRowById(entity: CrmEntityName, id: string): Promise<void> {
    await this.getRepo(entity).delete({ id });
  }

  async deleteRecordById(id: string): Promise<void> {
    for (const entity of Object.keys(CRM_ENTITY_CLASS_MAP) as CrmEntityName[]) {
      const res = await this.getRepo(entity).delete({ id });
      if (res.affected) return;
    }

    await this.usersRepository.delete(id);
  }

  private assertNotGenericUser(entity: EntityName): void {
    if (entity === 'User') {
      throw new ForbiddenException('Use /api/users for User management');
    }
  }

  private toRecord(entity: EntityName, row: Record<string, unknown>): Record<string, unknown> {
    if (entity === 'Payment') {
      return paymentToRecord(row as unknown as PaymentEntity);
    }
    if (entity === 'ShopSettings') {
      return shopItemToRecord(row as unknown as ShopItemEntity);
    }
    return entityToRecord(row);
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

  private assertNoSensitiveFields(
    entity: EntityName,
    input: Record<string, unknown>,
    context: EntityAccessContext,
  ): void {
    const isSystem = context.userId === 'system';
    const isAdmin = normalizeRole(context.role) === 'admin' || isSystem;

    for (const key of Object.keys(input)) {
      if (!isAdmin && USER_BLOCKED_UPDATE_FIELDS.has(key)) {
        throw new ForbiddenException(`Field "${key}" cannot be updated without admin role`);
      }

      if (!isAdmin && GLOBAL_SENSITIVE_FIELDS.has(key)) {
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

  private assertGenericMutationPolicy(
    entity: EntityName,
    action: 'create' | 'update' | 'delete',
    context: EntityAccessContext,
  ): void {
    const isAdmin =
      normalizeRole(context.role) === 'admin' || context.userId === 'system';

    if (entity === 'Payment' && !isAdmin) {
      throw new ForbiddenException(
        'Payment mutations must go through payment flows or administrator tools',
      );
    }

    if (entity === 'TeacherAvailabilityBooking') {
      throw new ForbiddenException(
        'Availability bookings are managed automatically through lesson scheduling',
      );
    }

    if (entity === 'LessonSeries' && action !== 'update') {
      throw new ForbiddenException(
        'Lesson series are managed automatically through lesson scheduling',
      );
    }

    if (entity === 'AppSettings' && action === 'create' && !isAdmin) {
      throw new ForbiddenException('AppSettings can only be modified by administrators');
    }
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
