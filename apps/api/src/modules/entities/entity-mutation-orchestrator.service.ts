import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EntityName } from '../../common/constants/entity-names';
import { CrmEntityName } from '../../common/constants/entity-registry';
import { APP_SETTINGS_SENSITIVE_KEYS } from '../../common/constants/entity-registry';
import { entityToRecord, recordToEntityPayload } from '../../common/utils/record.util';
import { LessonStudentEntity } from '../../entities/LessonStudent.entity';
import { StudentEntity } from '../../entities/Student.entity';
import { TeacherAvailabilityEntity } from '../../entities/TeacherAvailability.entity';
import { WelcomePageSettingEntity } from '../../entities/WelcomePageSetting.entity';
import { AuditService } from '../audit/audit.service';
import { PaymentService } from '../payments/payment.service';
import { LessonOrchestratorService } from '../schedule/lesson-orchestrator.service';
import { LessonSeriesOrchestratorService } from '../schedule/lesson-series-orchestrator.service';
import { ScheduleOrchestratorService } from '../schedule/schedule-orchestrator.service';
import { RoleEntitySyncService } from '../users/role-entity-sync.service';
import { welcomeInputToRows, welcomeRowsToRecord } from '../welcome/welcome.mapper';
import { LessonRepositoryService } from '../schedule/lesson-repository.service';
import { EntityAccessContext } from './entity-access.types';
import { EntityRepositoryService } from './entity-repository.service';

@Injectable()
export class EntityMutationOrchestratorService {
  constructor(
    private readonly repository: EntityRepositoryService,
    private readonly paymentService: PaymentService,
    private readonly roleEntitySync: RoleEntitySyncService,
    private readonly lessonOrchestrator: LessonOrchestratorService,
    private readonly lessonSeriesOrchestrator: LessonSeriesOrchestratorService,
    private readonly scheduleOrchestrator: ScheduleOrchestratorService,
    private readonly lessonRepository: LessonRepositoryService,
    private readonly audit: AuditService,
  ) {}

  async create(
    entity: EntityName,
    input: Record<string, unknown>,
    context: EntityAccessContext,
  ): Promise<Record<string, unknown>> {
    this.repository.assertCreate(entity, input, context);

    if (entity === 'Payment') {
      return this.paymentService.create(input);
    }

    if (entity === 'ShopSettings') {
      return this.repository.saveShopSettings(input);
    }

    if (entity === 'WelcomePageSettings') {
      return this.upsertWelcomePageSettings(input);
    }

    if (entity === 'Lesson') {
      const isRecurring = Boolean(input.is_recurring ?? input.isRecurring);
      if (isRecurring) {
        return this.lessonSeriesOrchestrator.createRecurringLesson(input, context);
      }
      return this.lessonOrchestrator.createLesson(input, context);
    }

    if (entity === 'TeacherAvailability') {
      return this.scheduleOrchestrator.createTeacherAvailability(input);
    }

    if (entity === 'LessonMaterial') {
      return this.scheduleOrchestrator.createLessonMaterial(input);
    }

    if (entity === 'Student') {
      return this.roleEntitySync.upsertStudentFromCreate(input);
    }

    if (entity === 'Teacher') {
      return this.roleEntitySync.upsertTeacherFromCreate(input);
    }

    const saved = await this.repository.saveGeneric(entity as CrmEntityName, input);

    if (entity === 'MaterialAccess') {
      await this.auditMaterialAccessChange(context, 'grant', saved);
    }

    if (entity === 'LessonStudent') {
      await this.lessonRepository.refreshLessonStudentFields(
        String((saved as unknown as LessonStudentEntity).lessonId),
      );
    }

    return entityToRecord(saved as Record<string, unknown>);
  }

  async update(
    entity: EntityName,
    id: string,
    input: Record<string, unknown>,
    context: EntityAccessContext,
  ): Promise<Record<string, unknown>> {
    const { row, currentRecord } = await this.repository.assertUpdate(entity, id, input, context);

    if (entity === 'WelcomePageSettings') {
      return this.upsertWelcomePageSettings(input);
    }

    if (entity === 'Payment') {
      return this.paymentService.update(id, input);
    }

    if (entity === 'Lesson') {
      return this.lessonOrchestrator.updateLesson(id, input, context);
    }

    if (entity === 'TeacherAvailability') {
      return this.scheduleOrchestrator.updateTeacherAvailability(id, input, row);
    }

    if (entity === 'LessonMaterial') {
      return this.scheduleOrchestrator.updateLessonMaterial(id, input);
    }

    if (entity === 'LessonSeries') {
      return this.lessonSeriesOrchestrator.updateLessonSeries(id, input);
    }

    if (entity === 'ShopSettings') {
      return this.repository.updateShopSettings(id, input, row);
    }

    if (entity === 'AppSettings') {
      await this.auditAppSettingsMutation(context, 'update', input, currentRecord);
    }

    const prevBalance =
      entity === 'Student' ? (currentRecord.lesson_balance ?? currentRecord.lessonBalance) : undefined;

    const saved = await this.repository.updateGeneric(entity as CrmEntityName, id, input, row);

    if (entity === 'Student' && prevBalance !== undefined) {
      const nextBalance = (saved as unknown as StudentEntity).lessonBalance;
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
      await this.lessonRepository.refreshLessonStudentFields(
        String((saved as unknown as LessonStudentEntity).lessonId),
      );
      const previousLessonId = String(currentRecord.lesson_id ?? currentRecord.lessonId ?? '');
      const nextLessonId = String((saved as unknown as LessonStudentEntity).lessonId ?? '');
      if (previousLessonId && previousLessonId !== nextLessonId) {
        await this.lessonRepository.refreshLessonStudentFields(previousLessonId);
      }
    }

    return entityToRecord(saved as Record<string, unknown>);
  }

  async delete(entity: EntityName, id: string, context: EntityAccessContext): Promise<void> {
    await this.repository.assertDelete(entity, id, context);

    if (entity === 'Payment') {
      await this.paymentService.delete(id);
      return;
    }

    if (entity === 'Lesson') {
      await this.lessonOrchestrator.deleteLesson(id);
      return;
    }

    if (entity === 'TeacherAvailability') {
      const row = await this.repository.findRowById(entity as CrmEntityName, id);
      const teacherId = String((row as unknown as TeacherAvailabilityEntity).teacherId ?? '');
      await this.scheduleOrchestrator.deleteTeacherAvailabilitySlots(teacherId);
    }

    if (entity === 'LessonStudent') {
      const row = await this.repository.findRowById(entity as CrmEntityName, id);
      const lessonId = String((row as unknown as LessonStudentEntity).lessonId ?? '');
      await this.repository.deleteRowById(entity as CrmEntityName, id);
      if (lessonId) {
        await this.lessonRepository.refreshLessonStudentFields(lessonId);
      }
      return;
    }

    await this.repository.deleteRowById(entity as CrmEntityName, id);
  }

  async bulkCreate(
    entity: EntityName,
    items: Record<string, unknown>[],
    context: EntityAccessContext,
  ): Promise<Record<string, unknown>[]> {
    const results: Record<string, unknown>[] = [];
    for (const item of items) {
      results.push(await this.create(entity, item, context));
    }
    return results;
  }

  private async upsertWelcomePageSettings(
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const repo = this.repository.getRepository('WelcomePageSettings');
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
  ): Promise<void> {
    await this.audit.log({
      actorUserId: context.userId,
      action: action === 'grant' ? 'material_access_grant' : 'material_access_update',
      entityType: 'MaterialAccess',
      entityId: String(record.id ?? ''),
      summary: `user=${record.user_id ?? record.userId} material=${record.material_id ?? record.materialId} access=${record.access}`,
    });
  }
}
