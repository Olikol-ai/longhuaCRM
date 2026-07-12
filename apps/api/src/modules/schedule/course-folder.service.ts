import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository, In } from 'typeorm';
import { entityToRecord, recordToEntityPayload } from '../../common/utils/record.util';
import { CourseEntity } from '../../entities/course.entity';
import { CourseFolderEntity } from '../../entities/course-folder.entity';
import { LessonMaterialEntity } from '../../entities/lesson-material.entity';

@Injectable()
export class CourseFolderService {
  constructor(
    @InjectRepository(CourseFolderEntity)
    private readonly folderRepo: Repository<CourseFolderEntity>,
    @InjectRepository(CourseEntity)
    private readonly courseRepo: Repository<CourseEntity>,
    @InjectRepository(LessonMaterialEntity)
    private readonly materialRepo: Repository<LessonMaterialEntity>,
  ) {}

  async create(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const payload = recordToEntityPayload(input);
    const courseId = String(payload.courseId ?? '').trim();
    const parentFolderId = this.normalizeOptionalId(payload.parentFolderId);

    await this.assertCourseExists(courseId);
    await this.validateParentAssignment({ courseId, parentFolderId });

    const now = new Date();
    const row = this.folderRepo.create({
      id: input.id ? String(input.id) : randomUUID(),
      courseId,
      parentFolderId,
      name: String(payload.name ?? '').trim() || 'Новая папка',
      sortOrder: Number(payload.sortOrder ?? 0),
      createdDate: now,
      updatedDate: now,
    });

    const saved = await this.folderRepo.save(row);
    return entityToRecord(saved as unknown as Record<string, unknown>);
  }

  async update(
    id: string,
    input: Record<string, unknown>,
    row: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const payload = recordToEntityPayload(input);
    const courseId = String(payload.courseId ?? row.course_id ?? row.courseId ?? '').trim();
    const parentFolderId =
      'parentFolderId' in payload || 'parent_folder_id' in input
        ? this.normalizeOptionalId(payload.parentFolderId)
        : this.normalizeOptionalId(row.parent_folder_id ?? row.parentFolderId);

    if (courseId) {
      await this.assertCourseExists(courseId);
    }
    await this.validateParentAssignment({
      courseId,
      parentFolderId,
      folderId: id,
    });

    const managed = await this.folderRepo.findOne({ where: { id } });
    if (!managed) {
      throw new NotFoundException('CourseFolder not found');
    }

    const nextCourseId = String(payload.courseId ?? managed.courseId ?? '').trim();
    if (payload.courseId != null && nextCourseId !== managed.courseId) {
      throw new BadRequestException('course_id cannot be changed for an existing folder');
    }

    Object.assign(managed, payload);
    managed.updatedDate = new Date();
    const saved = await this.folderRepo.save(managed);
    return entityToRecord(saved as unknown as Record<string, unknown>);
  }

  async delete(id: string): Promise<void> {
    const folder = await this.folderRepo.findOne({ where: { id } });
    if (!folder) {
      throw new NotFoundException('CourseFolder not found');
    }

    const descendantIds = await this.collectDescendantFolderIds(id);
    const folderIds = [id, ...descendantIds];

    if (folderIds.length > 0) {
      await this.materialRepo
        .createQueryBuilder()
        .update(LessonMaterialEntity)
        .set({ folderId: null, updatedDate: new Date() })
        .where('folder_id IN (:...folderIds)', { folderIds })
        .execute();
    }

    await this.folderRepo.update(
      { parentFolderId: id },
      { parentFolderId: null, updatedDate: new Date() },
    );
    await this.folderRepo.delete({ id });
  }

  async validateMaterialFolder(
    courseId: string,
    folderId: string | null | undefined,
  ): Promise<void> {
    if (!folderId) {
      return;
    }

    const folder = await this.folderRepo.findOne({ where: { id: folderId } });
    if (!folder) {
      throw new BadRequestException('Folder not found');
    }
    if (folder.courseId !== courseId) {
      throw new BadRequestException('Folder must belong to the selected course');
    }
  }

  async validateParentAssignment(params: {
    courseId: string;
    parentFolderId: string | null;
    folderId?: string;
  }): Promise<void> {
    const { courseId, parentFolderId, folderId } = params;
    if (!parentFolderId) {
      return;
    }

    if (folderId && parentFolderId === folderId) {
      throw new BadRequestException('Folder cannot be its own parent');
    }

    const parent = await this.folderRepo.findOne({ where: { id: parentFolderId } });
    if (!parent) {
      throw new BadRequestException('Parent folder not found');
    }
    if (parent.courseId !== courseId) {
      throw new BadRequestException('Parent folder must belong to the same course');
    }

    if (!folderId) {
      return;
    }

    let current: string | null = parentFolderId;
    const visited = new Set<string>();
    while (current) {
      if (current === folderId) {
        throw new BadRequestException('Circular folder reference detected');
      }
      if (visited.has(current)) {
        break;
      }
      visited.add(current);
      const node = await this.folderRepo.findOne({ where: { id: current } });
      if (!node) {
        break;
      }
      current = node.parentFolderId;
    }
  }

  private async assertCourseExists(courseId: string): Promise<void> {
    if (!courseId) {
      throw new BadRequestException('course_id is required');
    }
    const course = await this.courseRepo.findOne({ where: { id: courseId } });
    if (!course) {
      throw new BadRequestException('Course not found');
    }
  }

  private normalizeOptionalId(value: unknown): string | null {
    const id = String(value ?? '').trim();
    return id || null;
  }

  private async collectDescendantFolderIds(rootId: string): Promise<string[]> {
    const collected: string[] = [];
    let frontier = [rootId];

    while (frontier.length > 0) {
      const children = await this.folderRepo.find({
        where: { parentFolderId: In(frontier) },
      });
      if (children.length === 0) {
        break;
      }
      const childIds = children.map((child) => child.id).filter((childId) => childId !== rootId);
      collected.push(...childIds);
      frontier = childIds;
    }

    return [...new Set(collected)];
  }
}
