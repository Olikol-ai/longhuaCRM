import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { entityToRecord, recordToEntityPayload } from '../../common/utils/record.util';
import { LessonMaterialEntity } from '../../entities/lesson-material.entity';
import { LessonMaterialTagEntity } from '../../entities/lesson-material-tag.entity';
import { TeacherAvailabilityEntity } from '../../entities/teacher-availability.entity';
import { TeacherAvailabilitySlotEntity } from '../../entities/teacher-availability-slot.entity';
import { EntityEnrichmentService } from './entity-enrichment.service';
import { CourseFolderService } from './course-folder.service';

@Injectable()
export class ScheduleOrchestratorService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly enrichment: EntityEnrichmentService,
    private readonly courseFolderService: CourseFolderService,
  ) {}

  async createTeacherAvailability(
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const slots = this.parseAvailabilitySlots(input);
    const payload = { ...input };
    delete payload.slots;

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(TeacherAvailabilityEntity);
      const now = new Date();
      const id = payload.id ? String(payload.id) : randomUUID();
      const row = repo.create({
        id,
        ...recordToEntityPayload(payload),
        createdDate: now,
        updatedDate: now,
      });
      const saved = await repo.save(row);
      const teacherId = String(saved.teacherId);

      if (slots !== null) {
        await this.syncTeacherAvailabilitySlots(teacherId, slots, manager);
      }

      const record = entityToRecord(saved as unknown as Record<string, unknown>);
      return (await this.enrichment.enrich('TeacherAvailability', [record]))[0];
    });
  }

  async updateTeacherAvailability(
    id: string,
    input: Record<string, unknown>,
    row: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const slots = this.parseAvailabilitySlots(input);
    const payload = { ...input };
    delete payload.slots;

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(TeacherAvailabilityEntity);
      const managedRow = await repo.findOne({ where: { id } });
      if (!managedRow) {
        throw new NotFoundException('TeacherAvailability not found');
      }

      Object.assign(managedRow, recordToEntityPayload(payload));
      managedRow.updatedDate = new Date();
      const saved = await repo.save(managedRow);
      const teacherId = String(saved.teacherId ?? row.teacher_id ?? row.teacherId ?? '');

      if (slots !== null && teacherId) {
        await this.syncTeacherAvailabilitySlots(teacherId, slots, manager);
      }

      const record = entityToRecord(saved as unknown as Record<string, unknown>);
      return (await this.enrichment.enrich('TeacherAvailability', [record]))[0];
    });
  }

  async deleteTeacherAvailabilitySlots(teacherId: string): Promise<void> {
    if (!teacherId) {
      return;
    }
    await this.dataSource.getRepository(TeacherAvailabilitySlotEntity).delete({ teacherId });
  }

  async createLessonMaterial(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const tags = this.parseTags(input);
    const payload = { ...input };
    delete payload.tags;
    this.assertMaterialHasSource(payload);
    this.assertMaterialHasCourse(payload);

    const entityPayload = recordToEntityPayload(payload);
    const courseId = String(entityPayload.courseId ?? payload.course_id ?? '').trim();
    const folderId = this.normalizeOptionalId(entityPayload.folderId ?? payload.folder_id);
    await this.courseFolderService.validateMaterialFolder(courseId, folderId);

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(LessonMaterialEntity);
      const now = new Date();
      const id = payload.id ? String(payload.id) : randomUUID();
      const row = repo.create({
        id,
        ...recordToEntityPayload(payload),
        createdDate: now,
        updatedDate: now,
      });
      const saved = await repo.save(row);

      if (tags !== null) {
        await this.syncMaterialTags(String(saved.id), tags, manager);
      }

      const record = entityToRecord(saved as unknown as Record<string, unknown>);
      return (await this.enrichment.enrich('LessonMaterial', [record]))[0];
    });
  }

  async updateLessonMaterial(
    id: string,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const tags = this.parseTags(input);
    const payload = { ...input };
    delete payload.tags;

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(LessonMaterialEntity);
      const managedRow = await repo.findOne({ where: { id } });
      if (!managedRow) {
        throw new NotFoundException('LessonMaterial not found');
      }

      this.assertMaterialHasSource(payload, managedRow);

      const courseId = String(
        payload.course_id ?? payload.courseId ?? managedRow.courseId ?? '',
      ).trim();
      const folderId =
        'folder_id' in payload || 'folderId' in payload
          ? this.normalizeOptionalId(payload.folder_id ?? payload.folderId)
          : managedRow.folderId;
      await this.courseFolderService.validateMaterialFolder(courseId, folderId);

      Object.assign(managedRow, recordToEntityPayload(payload));
      managedRow.updatedDate = new Date();
      const saved = await repo.save(managedRow);

      if (tags !== null) {
        await this.syncMaterialTags(String(saved.id), tags, manager);
      }

      const record = entityToRecord(saved as unknown as Record<string, unknown>);
      return (await this.enrichment.enrich('LessonMaterial', [record]))[0];
    });
  }

  private parseAvailabilitySlots(
    input: Record<string, unknown>,
  ): { day: number; from: string; to: string }[] | null {
    if (!('slots' in input)) {
      return null;
    }
    const value = input.slots;
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((slot) => {
      const row = slot as Record<string, unknown>;
      return {
        day: Number(row.day),
        from: String(row.from ?? ''),
        to: String(row.to ?? ''),
      };
    });
  }

  private parseTags(input: Record<string, unknown>): string[] | null {
    if (!('tags' in input)) {
      return null;
    }
    const value = input.tags;
    if (Array.isArray(value)) {
      return value.map(String).filter(Boolean);
    }
    if (typeof value === 'string' && value.trim()) {
      return value.split(',').map((part) => part.trim()).filter(Boolean);
    }
    return [];
  }

  private async syncTeacherAvailabilitySlots(
    teacherId: string,
    slots: { day: number; from: string; to: string }[],
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(TeacherAvailabilitySlotEntity);
    await repo.delete({ teacherId });

    if (slots.length === 0) {
      return;
    }

    const now = new Date();
    for (const slot of slots) {
      await repo.save(
        repo.create({
          id: randomUUID(),
          teacherId,
          dayOfWeek: slot.day,
          timeFrom: slot.from,
          timeTo: slot.to,
          createdDate: now,
          updatedDate: now,
        }),
      );
    }
  }

  private async syncMaterialTags(
    materialId: string,
    tags: string[],
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(LessonMaterialTagEntity);
    const uniqueTags = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
    await repo.delete({ materialId });

    if (uniqueTags.length === 0) {
      return;
    }

    const now = new Date();
    for (const tag of uniqueTags) {
      await repo.save(
        repo.create({
          id: randomUUID(),
          materialId,
          tag,
          createdDate: now,
        }),
      );
    }
  }

  private assertMaterialHasCourse(payload: Record<string, unknown>): void {
    const courseId = String(payload.course_id ?? payload.courseId ?? '').trim();
    if (!courseId) {
      throw new BadRequestException('course_id is required');
    }
  }

  private assertMaterialHasSource(
    payload: Record<string, unknown>,
    existing?: Pick<LessonMaterialEntity, 'fileUrl' | 'externalLink'>,
  ): void {
    const fileUrl = String(
      payload.fileUrl ?? payload.file_url ?? existing?.fileUrl ?? '',
    ).trim();
    const externalLink = String(
      payload.externalLink ?? payload.external_link ?? existing?.externalLink ?? '',
    ).trim();
    if (!fileUrl && !externalLink) {
      throw new BadRequestException('Material requires a file upload or external link');
    }
  }

  private normalizeOptionalId(value: unknown): string | null {
    const id = String(value ?? '').trim();
    return id || null;
  }
}
