import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  CRM_ENTITY_CLASS_MAP,
  CrmEntityName,
  APP_SETTINGS_SENSITIVE_KEYS,
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
import { LessonStudentEntity } from '../../entities/LessonStudent.entity';
import { LessonEntity } from '../../entities/Lesson.entity';
import { PaymentEntity } from '../../entities/Payment.entity';
import { ShopItemEntity } from '../../entities/ShopItem.entity';
import { StudentEntity } from '../../entities/Student.entity';
import { WelcomePageSettingEntity } from '../../entities/WelcomePageSetting.entity';
import { paymentToRecord } from '../payments/payment.mapper';
import { PaymentService } from '../payments/payment.service';
import { AuditService } from '../audit/audit.service';
import { recordToShopItemPayload, shopItemToRecord } from '../shop/shop.mapper';
import { welcomeInputToRows, welcomeRowsToRecord } from '../welcome/welcome.mapper';
import { StudentBalanceService } from '../students/student-balance.service';
import { UsersRepository } from '../users/users.repository';
import { EntityAccessService } from './entity-access.service';
import { EntityAccessContext } from './entity-access.types';

/** Fields that non-admin users must never mutate via generic entity API. */
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
    private readonly paymentService: PaymentService,
    private readonly studentBalanceService: StudentBalanceService,
    private readonly audit: AuditService,
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
    this.assertGenericMutationPolicy(entity, 'create', context);

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

    if (entity === 'Lesson') {
      return this.createLesson(input, context);
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

    if (entity === 'MaterialAccess') {
      await this.auditMaterialAccessChange(context, 'grant', saved as Record<string, unknown>);
    }

    if (entity === 'LessonStudent') {
      await this.refreshLessonStudentFields(String((saved as LessonStudentEntity).lessonId));
    }

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
    this.assertGenericMutationPolicy(entity, 'update', context);

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

    if (entity === 'Lesson') {
      return this.updateLesson(id, input, context, row, currentRecord);
    }

    const payload = recordToEntityPayload(input);

    if (entity === 'ShopSettings') {
      Object.assign(row, recordToShopItemPayload(input));
      (row as { updatedDate: Date }).updatedDate = new Date();
      const saved = await repo.save(row);
      return shopItemToRecord(saved as ShopItemEntity);
    }

    if (entity === 'AppSettings') {
      await this.auditAppSettingsMutation(context, 'update', input, currentRecord);
    }

    Object.assign(row, payload);
    (row as { updatedDate: Date }).updatedDate = new Date();

    const prevBalance =
      entity === 'Student' ? (currentRecord.lesson_balance ?? currentRecord.lessonBalance) : undefined;

    const saved = await repo.save(row);

    if (entity === 'Student' && prevBalance !== undefined) {
      const nextBalance = (saved as StudentEntity).lessonBalance;
      if (Number(prevBalance) !== Number(nextBalance)) {
        await this.audit.log({
          actorUserId: context.userId,
          action: 'lesson_balance_change',
          entityType: 'Student',
          entityId: id,
          summary: `balance: ${prevBalance} → ${nextBalance}`,
        });
      }
    }

    if (entity === 'MaterialAccess') {
      await this.auditMaterialAccessChange(context, 'update', entityToRecord(saved as Record<string, unknown>));
    }

    if (entity === 'LessonStudent') {
      await this.refreshLessonStudentFields(String((saved as LessonStudentEntity).lessonId));
      const previousLessonId = String(currentRecord.lesson_id ?? currentRecord.lessonId ?? '');
      const nextLessonId = String((saved as LessonStudentEntity).lessonId ?? '');
      if (previousLessonId && previousLessonId !== nextLessonId) {
        await this.refreshLessonStudentFields(previousLessonId);
      }
    }

    return entityToRecord(saved as Record<string, unknown>);
  }

  async delete(entity: EntityName, id: string, context: EntityAccessContext) {
    this.assertNotGenericUser(entity);
    this.entityAccess.assertCan(entity, 'delete', context);
    this.assertGenericMutationPolicy(entity, 'delete', context);

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

    if (entity === 'Lesson') {
      await this.getRepo('LessonStudent').delete({ lessonId: id });
    }

    if (entity === 'LessonStudent') {
      const lessonId = String((row as LessonStudentEntity).lessonId ?? '');
      await repo.delete({ id });
      if (lessonId) {
        await this.refreshLessonStudentFields(lessonId);
      }
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

  private parseStudentIds(input: Record<string, unknown>): string[] | null {
    if ('student_ids' in input) {
      const value = input.student_ids;
      if (Array.isArray(value)) {
        return value.map(String).filter(Boolean);
      }
      if (typeof value === 'string' && value.trim()) {
        return value.split(',').map((part) => part.trim()).filter(Boolean);
      }
      return [];
    }
    if ('studentIds' in input) {
      const value = input.studentIds;
      if (Array.isArray(value)) {
        return value.map(String).filter(Boolean);
      }
    }
    return null;
  }

  private normalizeLessonInput(input: Record<string, unknown>): {
    lessonInput: Record<string, unknown>;
    studentIds: string[] | null;
  } {
    const studentIds = this.parseStudentIds(input);
    const lessonInput = { ...input };
    delete lessonInput.student_ids;
    delete lessonInput.studentIds;

    if (studentIds !== null) {
      lessonInput.student_ids = studentIds;
      if (studentIds.length > 0) {
        lessonInput.student_id = studentIds[0];
        lessonInput.lesson_type = studentIds.length > 1 ? 'group' : 'individual';
      }
    }

    return { lessonInput, studentIds };
  }

  private async syncLessonStudents(
    lessonId: string,
    studentIds: string[],
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(LessonStudentEntity)
      : this.getRepo('LessonStudent');
    const uniqueIds = [...new Set(studentIds.map(String).filter(Boolean))];

    await repo.delete({ lessonId });

    if (uniqueIds.length === 0) {
      return;
    }

    const now = new Date();
    for (const studentId of uniqueIds) {
      await repo.save(
        repo.create({
          id: randomUUID(),
          lessonId,
          studentId,
          attendanceStatus: 'enrolled',
          balanceDeducted: false,
          createdDate: now,
          updatedDate: now,
        }),
      );
    }
  }

  private async refreshLessonStudentFields(
    lessonId: string,
    manager?: EntityManager,
  ): Promise<void> {
    if (!lessonId) return;

    const lsRepo = manager
      ? manager.getRepository(LessonStudentEntity)
      : this.getRepo('LessonStudent');
    const lessonRepo = manager
      ? manager.getRepository(LessonEntity)
      : this.getRepo('Lesson');

    const lesson = await lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) return;

    const rows = await lsRepo.find({ where: { lessonId } });
    const ids = rows.map((row) => String(row.studentId));

    lesson.studentIds = ids;
    lesson.studentId = ids[0] ?? null;
    lesson.lessonType = ids.length > 1 ? 'group' : 'individual';
    lesson.updatedDate = new Date();
    await lessonRepo.save(lesson);
  }

  private async createLesson(
    input: Record<string, unknown>,
    _context: EntityAccessContext,
  ): Promise<Record<string, unknown>> {
    const { lessonInput, studentIds } = this.normalizeLessonInput(input);

    return this.dataSource.transaction(async (manager) => {
      const lessonRepo = manager.getRepository(LessonEntity);
      const now = new Date();
      const id = lessonInput.id ? String(lessonInput.id) : randomUUID();
      const payload = recordToEntityPayload(lessonInput);

      const row = lessonRepo.create({
        id,
        ...payload,
        createdDate: now,
        updatedDate: now,
      });

      const saved = await lessonRepo.save(row);
      const idsToSync =
        studentIds ??
        (saved.studentId ? [String(saved.studentId)] : []);

      if (studentIds !== null || idsToSync.length > 0) {
        await this.syncLessonStudents(String(saved.id), idsToSync, manager);
        await this.refreshLessonStudentFields(String(saved.id), manager);
        const refreshed = await lessonRepo.findOne({ where: { id: saved.id } });
        return entityToRecord((refreshed ?? saved) as unknown as Record<string, unknown>);
      }

      return entityToRecord(saved as unknown as Record<string, unknown>);
    });
  }

  private async updateLesson(
    id: string,
    input: Record<string, unknown>,
    _context: EntityAccessContext,
    row: Record<string, unknown>,
    _currentRecord: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const { lessonInput, studentIds } = this.normalizeLessonInput(input);
    const payload = recordToEntityPayload(lessonInput);

    return this.dataSource.transaction(async (manager) => {
      const lessonRepo = manager.getRepository(LessonEntity);
      const managedRow = await lessonRepo.findOne({ where: { id } });
      if (!managedRow) {
        throw new NotFoundException('Lesson not found');
      }

      Object.assign(managedRow, payload);
      managedRow.updatedDate = new Date();
      const saved = await lessonRepo.save(managedRow);

      if (studentIds !== null) {
        await this.syncLessonStudents(id, studentIds, manager);
        await this.refreshLessonStudentFields(id, manager);
      }

      if (lessonInput.status !== undefined) {
        await this.studentBalanceService.handleLessonStatusUpdate(id, String(lessonInput.status));
      }

      const refreshed = await lessonRepo.findOne({ where: { id } });
      return entityToRecord((refreshed ?? saved) as unknown as Record<string, unknown>);
    });
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

    if (entity === 'AppSettings' && action === 'create' && !isAdmin) {
      throw new ForbiddenException('AppSettings can only be modified by administrators');
    }
  }

  private async auditAppSettingsMutation(
    context: EntityAccessContext,
    action: 'create' | 'update',
    input: Record<string, unknown>,
    current?: Record<string, unknown>,
  ): Promise<void> {
    const key = String(input.key ?? current?.key ?? '');
    if (!APP_SETTINGS_SENSITIVE_KEYS.has(key)) {
      return;
    }

    await this.audit.log({
      actorUserId: context.userId,
      action: 'app_settings_change',
      entityType: 'AppSettings',
      entityId: key,
      summary: `${action} sensitive setting "${key}"`,
    });
  }

  private async auditMaterialAccessChange(
    context: EntityAccessContext,
    action: 'grant' | 'update',
    record: Record<string, unknown>,
  ) {
    await this.audit.log({
      actorUserId: context.userId,
      action: action === 'grant' ? 'material_access_grant' : 'material_access_update',
      entityType: 'MaterialAccess',
      entityId: String(record.id ?? ''),
      summary: `user=${record.user_id ?? record.userId} material=${record.material_id ?? record.materialId} access=${record.access}`,
    });
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
