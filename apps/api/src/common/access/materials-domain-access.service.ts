import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { normalizeRole } from '../constants/roles';
import { filterToEntityWhere } from '../utils/api-record.util';
import { EnrollmentEntity } from '../../modules/courses/entities/enrollment.entity';
import { CourseTemplateEntity } from '../../modules/courses/entities/course-template.entity';
import { MaterialAccessEntity } from '../../modules/materials/entities/material-access.entity';
import { MaterialCourseGrantEntity } from '../../modules/materials/entities/material-course-grant.entity';
import { MaterialFolderEntity } from '../../modules/materials/entities/material-folder.entity';
import { MaterialGroupGrantEntity } from '../../modules/materials/entities/material-group-grant.entity';
import { MaterialEntity } from '../../modules/materials/entities/material.entity';
import { GroupEntity } from '../../modules/groups/entities/group.entity';
import { GroupMemberEntity } from '../../modules/groups/entities/group-member.entity';
import { StudentEntity } from '../../modules/students/entities/student.entity';
import { TeacherEntity } from '../../modules/teachers/entities/teacher.entity';
import { TutorStudentEntity } from '../../modules/tutors/entities/tutor-student.entity';
import { NO_ACCESS_UUID } from './access.constants';
import { DomainAccessActor } from './domain-access.types';

/** Why a user can see a material — used by UI badges. */
export type MaterialAccessSourceType = 'personal' | 'course' | 'group';

export const ACCESS_SOURCE_LABELS: Record<MaterialAccessSourceType, string> = {
  personal: 'Персональный доступ',
  course: 'Доступ через курс',
  group: 'Доступ через группу',
};

type AccessBuckets = {
  personal: Set<string>;
  course: Set<string>;
  group: Set<string>;
};

type CacheEntry<T> = {
  expiresAt: number;
  value?: T;
  inflight?: Promise<T>;
};

/** Short TTL coalesces parallel /materials + /folders on page open. */
const ACCESS_CACHE_TTL_MS = 3_000;

@Injectable()
export class MaterialsDomainAccessService {
  private readonly bucketsCache = new Map<string, CacheEntry<AccessBuckets>>();
  private readonly materialIdsCache = new Map<string, CacheEntry<string[]>>();
  private readonly courseIdsCache = new Map<string, CacheEntry<string[]>>();

  constructor(
    @InjectRepository(MaterialEntity)
    private readonly materialRepo: Repository<MaterialEntity>,
    @InjectRepository(MaterialFolderEntity)
    private readonly folderRepo: Repository<MaterialFolderEntity>,
    @InjectRepository(MaterialAccessEntity)
    private readonly accessRepo: Repository<MaterialAccessEntity>,
    @InjectRepository(MaterialCourseGrantEntity)
    private readonly courseGrantRepo: Repository<MaterialCourseGrantEntity>,
    @InjectRepository(MaterialGroupGrantEntity)
    private readonly groupGrantRepo: Repository<MaterialGroupGrantEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepo: Repository<EnrollmentEntity>,
    @InjectRepository(CourseTemplateEntity)
    private readonly courseTemplateRepo: Repository<CourseTemplateEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepo: Repository<GroupEntity>,
    @InjectRepository(GroupMemberEntity)
    private readonly groupMemberRepo: Repository<GroupMemberEntity>,
    @InjectRepository(TutorStudentEntity)
    private readonly tutorStudentRepo: Repository<TutorStudentEntity>,
  ) {}

  isAdmin(actor: DomainAccessActor): boolean {
    return normalizeRole(actor.role) === 'admin';
  }

  /** Drop cached ACL for one user (or everyone) after grant/revoke/create. */
  invalidateAccessCache(userId?: string): void {
    if (!userId) {
      this.bucketsCache.clear();
      this.materialIdsCache.clear();
      this.courseIdsCache.clear();
      return;
    }
    const prefix = `${userId}:`;
    for (const map of [this.bucketsCache, this.materialIdsCache, this.courseIdsCache]) {
      for (const key of map.keys()) {
        if (key.startsWith(prefix)) {
          map.delete(key);
        }
      }
    }
  }

  async scopeMaterialFilter(
    actor: DomainAccessActor,
    where: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (this.isAdmin(actor)) {
      return filterToEntityWhere(where);
    }

    const role = normalizeRole(actor.role);
    if (
      role !== 'student' &&
      role !== 'teacher' &&
      role !== 'tutor' &&
      role !== 'tutor_student'
    ) {
      throw new ForbiddenException('Forbidden');
    }

    const ids = await this.resolveAccessibleMaterialIds(actor);
    if (ids.length === 0) {
      return { id: NO_ACCESS_UUID };
    }

    const scoped = filterToEntityWhere(where);
    if (scoped.id) {
      const requested = String(scoped.id);
      if (!ids.includes(requested)) {
        return { id: NO_ACCESS_UUID };
      }
      return { ...scoped, id: requested };
    }

    return { ...scoped, id: In(ids) };
  }

  async scopeFolderFilter(
    actor: DomainAccessActor,
    where: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (this.isAdmin(actor)) {
      return filterToEntityWhere(where);
    }

    const role = normalizeRole(actor.role);
    if (role === 'tutor') {
      // Tutors only see personal folders they own (never school course folders).
      return {
        ...filterToEntityWhere(where),
        createdByUserId: actor.sub,
      };
    }

    if (role === 'student' || role === 'teacher') {
      const courseTemplateIds = await this.resolveAccessibleCourseTemplateIds(actor);
      if (courseTemplateIds.length === 0) {
        return { courseTemplateId: NO_ACCESS_UUID };
      }
      const scoped = filterToEntityWhere(where);
      if (scoped.courseTemplateId) {
        const requested = String(scoped.courseTemplateId);
        if (!courseTemplateIds.includes(requested)) {
          return { courseTemplateId: NO_ACCESS_UUID };
        }
        return { ...scoped, courseTemplateId: requested };
      }
      return { ...scoped, courseTemplateId: In(courseTemplateIds) };
    }

    if (role === 'tutor_student') {
      // Folder tree is unused for tutor students; they open materials via ACL list.
      return { id: NO_ACCESS_UUID };
    }

    throw new ForbiddenException('Forbidden');
  }

  async assertCanReadMaterial(actor: DomainAccessActor, materialId: string): Promise<void> {
    if (this.isAdmin(actor)) {
      return;
    }

    const material = await this.materialRepo.findOne({ where: { id: materialId } });
    if (!material || material.status === 'deleted') {
      throw new NotFoundException('Material not found');
    }

    const ids = await this.resolveAccessibleMaterialIds(actor);
    if (!ids.includes(materialId)) {
      throw new ForbiddenException('Cannot access this material');
    }
  }

  async resolveAccessibleMaterialIds(actor: DomainAccessActor): Promise<string[]> {
    if (this.isAdmin(actor)) {
      const rows = await this.materialRepo.find({
        where: { status: 'active' },
        select: ['id'],
      });
      return rows.map((row) => row.id);
    }

    const cacheKey = this.cacheKey(actor);
    return this.readThrough(this.materialIdsCache, cacheKey, async () => {
      const buckets = await this.resolveAccessBuckets(actor);
      const ids = new Set<string>([
        ...buckets.personal,
        ...buckets.course,
        ...buckets.group,
      ]);

      if (ids.size === 0) {
        return [];
      }

      const active = await this.materialRepo.find({
        where: { id: In([...ids]), status: 'active' },
        select: ['id'],
      });
      return active.map((row) => row.id);
    });
  }

  /**
   * Explains why each material is visible to the actor.
   * Admin gets an empty map (sees everything without inheritance reasons).
   */
  async resolveAccessSources(
    actor: DomainAccessActor,
    materialIds: string[],
  ): Promise<
    Record<
      string,
      Array<{ type: MaterialAccessSourceType; label: string }>
    >
  > {
    if (materialIds.length === 0 || this.isAdmin(actor)) {
      return {};
    }

    const buckets = await this.resolveAccessBuckets(actor);
    return this.sourcesFromBuckets(buckets, materialIds);
  }

  sourcesFromBuckets(
    buckets: AccessBuckets,
    materialIds: string[],
  ): Record<string, Array<{ type: MaterialAccessSourceType; label: string }>> {
    const result: Record<
      string,
      Array<{ type: MaterialAccessSourceType; label: string }>
    > = {};

    for (const materialId of materialIds) {
      const sources: Array<{ type: MaterialAccessSourceType; label: string }> = [];
      if (buckets.personal.has(materialId)) {
        sources.push({ type: 'personal', label: ACCESS_SOURCE_LABELS.personal });
      }
      if (buckets.course.has(materialId)) {
        sources.push({ type: 'course', label: ACCESS_SOURCE_LABELS.course });
      }
      if (buckets.group.has(materialId)) {
        sources.push({ type: 'group', label: ACCESS_SOURCE_LABELS.group });
      }
      if (sources.length > 0) {
        result[materialId] = sources;
      }
    }

    return result;
  }

  /**
   * Shared ACL buckets for list endpoints (cached briefly per user+role).
   */
  async resolveAccessBuckets(actor: DomainAccessActor): Promise<AccessBuckets> {
    const cacheKey = this.cacheKey(actor);
    return this.readThrough(this.bucketsCache, cacheKey, () => this.computeAccessBuckets(actor));
  }

  private async computeAccessBuckets(actor: DomainAccessActor): Promise<AccessBuckets> {
    const personal = new Set<string>();
    const course = new Set<string>();
    const group = new Set<string>();

    const personalRows = await this.accessRepo.find({
      where: { userId: actor.sub, access: true },
      select: ['materialId'],
    });
    for (const row of personalRows) {
      personal.add(row.materialId);
    }

    const role = normalizeRole(actor.role);
    if (role === 'teacher' || role === 'tutor') {
      // Authors always see materials they created (even if a personal grant row is missing).
      const owned = await this.materialRepo.find({
        where: { createdByUserId: actor.sub, status: 'active' },
        select: ['id'],
      });
      for (const row of owned) {
        personal.add(row.id);
      }
    }

    if (role === 'tutor_student') {
      const tutorStudents = await this.tutorStudentRepo.find({
        where: { userId: actor.sub },
        select: ['id'],
      });
      const tutorStudentIds = tutorStudents.map((row) => row.id);
      if (tutorStudentIds.length > 0) {
        const viaTutorStudent = await this.accessRepo.find({
          where: { tutorStudentId: In(tutorStudentIds), access: true },
          select: ['materialId'],
        });
        for (const row of viaTutorStudent) {
          personal.add(row.materialId);
        }
      }
    }

    if (role === 'student') {
      await this.fillStudentBuckets(actor.sub, course, group);
    } else if (role === 'teacher') {
      await this.fillTeacherBuckets(actor.sub, course, group);
    }
    // Tutors intentionally skip school course/group inheritance.

    return { personal, course, group };
  }

  private async fillStudentBuckets(
    userId: string,
    course: Set<string>,
    group: Set<string>,
  ): Promise<void> {
    const student = await this.studentRepo.findOne({ where: { userId } });
    if (!student) {
      return;
    }

    const enrollments = await this.enrollmentRepo.find({
      where: { studentId: student.id },
      select: ['courseTemplateId'],
    });
    const courseIds = [
      ...new Set(
        enrollments.map((row) => row.courseTemplateId).filter((id): id is string => Boolean(id)),
      ),
    ];
    await this.addCourseRelatedMaterialIds(courseIds, course);

    const memberships = await this.groupMemberRepo.find({
      where: { studentId: student.id },
      select: ['groupId'],
    });
    const groupIds = memberships.map((row) => row.groupId);
    if (groupIds.length > 0) {
      const grants = await this.groupGrantRepo.find({
        where: { groupId: In(groupIds) },
        select: ['materialId'],
      });
      for (const row of grants) {
        group.add(row.materialId);
      }
    }
  }

  private async fillTeacherBuckets(
    userId: string,
    course: Set<string>,
    group: Set<string>,
  ): Promise<void> {
    const teacher = await this.teacherRepo.findOne({ where: { userId } });
    if (!teacher) {
      return;
    }

    const groups = await this.groupRepo.find({
      where: { teacherId: teacher.id },
      select: ['id'],
    });
    const taughtGroupIds = groups.map((row) => row.id);
    if (taughtGroupIds.length > 0) {
      const groupGrants = await this.groupGrantRepo.find({
        where: { groupId: In(taughtGroupIds) },
        select: ['materialId'],
      });
      for (const row of groupGrants) {
        group.add(row.materialId);
      }
    }

    const studentIds: string[] = [];
    const assignedStudents = await this.studentRepo.find({
      where: { assignedTeacherId: teacher.id },
      select: ['id'],
    });
    studentIds.push(...assignedStudents.map((row) => row.id));

    if (taughtGroupIds.length > 0) {
      const members = await this.groupMemberRepo.find({
        where: { groupId: In(taughtGroupIds) },
        select: ['studentId'],
      });
      studentIds.push(...members.map((row) => row.studentId));
    }

    const uniqueStudentIds = [...new Set(studentIds)];
    if (uniqueStudentIds.length === 0) {
      return;
    }

    const enrollments = await this.enrollmentRepo.find({
      where: { studentId: In(uniqueStudentIds) },
      select: ['courseTemplateId'],
    });
    const courseIds = [
      ...new Set(
        enrollments.map((row) => row.courseTemplateId).filter((id): id is string => Boolean(id)),
      ),
    ];
    await this.addCourseRelatedMaterialIds(courseIds, course);
  }

  private async addCourseRelatedMaterialIds(
    courseIds: string[],
    ids: Set<string>,
  ): Promise<void> {
    const activeIds = await this.filterActiveCourseIds(courseIds);
    if (activeIds.length === 0) {
      return;
    }

    const grants = await this.courseGrantRepo.find({
      where: { courseTemplateId: In(activeIds) },
      select: ['materialId'],
    });
    for (const row of grants) {
      ids.add(row.materialId);
    }

    // Single JOIN instead of folders → materials N-step load.
    const folderMaterials: Array<{ id: string }> = await this.materialRepo
      .createQueryBuilder('m')
      .innerJoin(MaterialFolderEntity, 'f', 'f.id = m.folder_id')
      .where('f.course_template_id IN (:...courseIds)', { courseIds: activeIds })
      .andWhere('m.status = :status', { status: 'active' })
      .select('m.id', 'id')
      .getRawMany();

    for (const row of folderMaterials) {
      ids.add(row.id);
    }
  }

  private async filterActiveCourseIds(courseIds: string[]): Promise<string[]> {
    const unique = [...new Set(courseIds.filter(Boolean))];
    if (unique.length === 0) {
      return [];
    }
    const rows = await this.courseTemplateRepo.find({
      where: { id: In(unique), isActive: true },
      select: ['id'],
    });
    return rows.map((row) => row.id);
  }

  private async resolveAccessibleCourseTemplateIds(actor: DomainAccessActor): Promise<string[]> {
    const role = normalizeRole(actor.role);
    const cacheKey = this.cacheKey(actor);

    return this.readThrough(this.courseIdsCache, cacheKey, async () => {
      if (role === 'student') {
        const student = await this.studentRepo.findOne({ where: { userId: actor.sub } });
        if (!student) {
          return [];
        }
        const enrollments = await this.enrollmentRepo.find({
          where: { studentId: student.id },
          select: ['courseTemplateId'],
        });
        return this.filterActiveCourseIds(
          enrollments.map((row) => row.courseTemplateId).filter((id): id is string => Boolean(id)),
        );
      }

      if (role === 'teacher') {
        const courseIds = new Set<string>();

        const teacher = await this.teacherRepo.findOne({ where: { userId: actor.sub } });
        if (teacher) {
          const studentIds: string[] = [];
          const assigned = await this.studentRepo.find({
            where: { assignedTeacherId: teacher.id },
            select: ['id'],
          });
          studentIds.push(...assigned.map((row) => row.id));

          const groups = await this.groupRepo.find({
            where: { teacherId: teacher.id },
            select: ['id'],
          });
          if (groups.length > 0) {
            const members = await this.groupMemberRepo.find({
              where: { groupId: In(groups.map((row) => row.id)) },
              select: ['studentId'],
            });
            studentIds.push(...members.map((row) => row.studentId));
          }

          const uniqueStudentIds = [...new Set(studentIds)];
          if (uniqueStudentIds.length > 0) {
            const enrollments = await this.enrollmentRepo.find({
              where: { studentId: In(uniqueStudentIds) },
              select: ['courseTemplateId'],
            });
            for (const row of enrollments) {
              if (row.courseTemplateId) {
                courseIds.add(row.courseTemplateId);
              }
            }
          }
        }

        // Reuse ACL buckets (cached) instead of a full second resolveAccessibleMaterialIds.
        // Otherwise teachers see materials but an empty folder tree (white/broken UX).
        const buckets = await this.resolveAccessBuckets(actor);
        const accessibleMaterialIds = [
          ...new Set([...buckets.personal, ...buckets.course, ...buckets.group]),
        ];
        if (accessibleMaterialIds.length > 0) {
          const materials = await this.materialRepo.find({
            where: { id: In(accessibleMaterialIds), status: 'active' },
            select: ['folderId'],
          });
          const folderIds = [
            ...new Set(
              materials.map((row) => row.folderId).filter((id): id is string => Boolean(id)),
            ),
          ];
          if (folderIds.length > 0) {
            const folders = await this.folderRepo.find({
              where: { id: In(folderIds) },
              select: ['courseTemplateId'],
            });
            for (const folder of folders) {
              if (folder.courseTemplateId) {
                courseIds.add(folder.courseTemplateId);
              }
            }
          }
        }

        return this.filterActiveCourseIds([...courseIds]);
      }

      return [];
    });
  }

  private cacheKey(actor: DomainAccessActor): string {
    return `${actor.sub}:${normalizeRole(actor.role)}`;
  }

  private async readThrough<T>(
    cache: Map<string, CacheEntry<T>>,
    key: string,
    loader: () => Promise<T>,
  ): Promise<T> {
    const now = Date.now();
    const existing = cache.get(key);
    if (existing && existing.value !== undefined && existing.expiresAt > now) {
      return existing.value;
    }
    if (existing?.inflight) {
      return existing.inflight;
    }

    const inflight = loader()
      .then((value) => {
        cache.set(key, { value, expiresAt: Date.now() + ACCESS_CACHE_TTL_MS });
        return value;
      })
      .catch((error) => {
        cache.delete(key);
        throw error;
      });

    cache.set(key, { expiresAt: now + ACCESS_CACHE_TTL_MS, inflight });
    return inflight;
  }
}
