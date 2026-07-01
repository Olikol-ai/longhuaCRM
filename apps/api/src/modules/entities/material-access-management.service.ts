import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { GrantedByRole, MaterialAccessEntity } from '../../entities/MaterialAccess.entity';
import { CourseEntity } from '../../entities/Course.entity';
import { LessonMaterialEntity } from '../../entities/LessonMaterial.entity';
import { StudentEntity } from '../../entities/Student.entity';
import { TeacherEntity } from '../../entities/Teacher.entity';
import { EntityAccessContext } from './entity-access.types';
import { MaterialAccessCheckService } from './material-access-check.service';
import { MaterialAccessWriteService } from './material-access-write.service';

export type MaterialAccessTargetType = 'student' | 'teacher';

export interface MaterialAccessEditorMaterial {
  id: string;
  title: string;
  granted: boolean;
}

export interface MaterialAccessEditorCourse {
  id: string;
  course_name: string;
  materials: MaterialAccessEditorMaterial[];
}

export interface MaterialAccessEditorData {
  target: {
    user_id: string;
    name: string;
    email: string;
    type: MaterialAccessTargetType;
  };
  courses: MaterialAccessEditorCourse[];
}

@Injectable()
export class MaterialAccessManagementService {
  constructor(
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    @InjectRepository(CourseEntity)
    private readonly courseRepo: Repository<CourseEntity>,
    @InjectRepository(LessonMaterialEntity)
    private readonly materialRepo: Repository<LessonMaterialEntity>,
    private readonly materialAccessCheck: MaterialAccessCheckService,
    private readonly accessWrite: MaterialAccessWriteService,
  ) {}

  async getEditorData(
    targetUserId: string,
    context: EntityAccessContext,
  ): Promise<MaterialAccessEditorData> {
    const target = await this.resolveTargetUser(targetUserId, context);
    const manageableIds = await this.getManageableMaterialIds(context);
    const grantedIds = await this.materialAccessCheck.getGrantedMaterialIds(targetUserId);

    const materials = await this.materialRepo.find({
      order: { createdDate: 'DESC' },
    });
    const visibleMaterials = materials.filter((m) => manageableIds.has(m.id));

    const courseIds = [
      ...new Set(visibleMaterials.map((m) => m.courseId).filter(Boolean)),
    ];
    const courses =
      courseIds.length > 0
        ? await this.courseRepo.find({ where: { id: In(courseIds) } })
        : [];
    const courseById = new Map(courses.map((c) => [c.id, c]));

    const materialsByCourse = new Map<string, LessonMaterialEntity[]>();
    for (const material of visibleMaterials) {
      const courseId = material.courseId || 'uncategorized';
      if (!materialsByCourse.has(courseId)) {
        materialsByCourse.set(courseId, []);
      }
      materialsByCourse.get(courseId)!.push(material);
    }

    const editorCourses: MaterialAccessEditorCourse[] = [];
    for (const [courseId, courseMaterials] of materialsByCourse) {
      const course = courseById.get(courseId);
      editorCourses.push({
        id: courseId,
        course_name: course?.courseName || course?.courseType || 'Без курса',
        materials: courseMaterials.map((m) => ({
          id: m.id,
          title: m.title,
          granted: grantedIds.has(m.id),
        })),
      });
    }

    editorCourses.sort((a, b) => a.course_name.localeCompare(b.course_name, 'ru'));

    return {
      target,
      courses: editorCourses,
    };
  }

  async syncUserAccess(
    targetUserId: string,
    requestedMaterialIds: string[],
    context: EntityAccessContext,
  ): Promise<{ granted_count: number; revoked_count: number }> {
    await this.resolveTargetUser(targetUserId, context);

    const uniqueIds = [...new Set(requestedMaterialIds.map(String).filter(Boolean))];
    const manageableIds = await this.getManageableMaterialIds(context);
    const invalid = uniqueIds.filter((id) => !manageableIds.has(id));
    if (invalid.length > 0) {
      throw new ForbiddenException(
        'Forbidden: cannot grant access to materials you do not manage',
      );
    }

    const auditRole = this.getAuditRole(context);
    const currentGranted = await this.materialAccessCheck.getGrantedMaterialIds(targetUserId);
    const requestedSet = new Set(uniqueIds);

    let grantedCount = 0;
    let revokedCount = 0;

    for (const materialId of uniqueIds) {
      if (!currentGranted.has(materialId)) {
        await this.accessWrite.grantAccess(targetUserId, materialId, auditRole);
        grantedCount += 1;
      }
    }

    for (const materialId of currentGranted) {
      if (!requestedSet.has(materialId) && manageableIds.has(materialId)) {
        await this.accessWrite.revokeAccess(targetUserId, materialId);
        revokedCount += 1;
      }
    }

    return { granted_count: grantedCount, revoked_count: revokedCount };
  }

  private async resolveTargetUser(
    targetUserId: string,
    context: EntityAccessContext,
  ): Promise<MaterialAccessEditorData['target']> {
    if (!targetUserId?.trim()) {
      throw new BadRequestException('user_id is required');
    }

    const student = await this.studentRepo.findOne({
      where: { userId: targetUserId },
    });
    if (student) {
      await this.assertCanManageTarget(targetUserId, 'student', context, student);
      return {
        user_id: targetUserId,
        name: student.name,
        email: student.email,
        type: 'student',
      };
    }

    const teacher = await this.teacherRepo.findOne({
      where: { userId: targetUserId },
    });
    if (teacher) {
      if (context.role !== 'admin') {
        throw new ForbiddenException(
          'Forbidden: only admin can manage teacher material access',
        );
      }
      return {
        user_id: targetUserId,
        name: teacher.name,
        email: teacher.email,
        type: 'teacher',
      };
    }

    throw new NotFoundException('User profile not found');
  }

  private async assertCanManageTarget(
    targetUserId: string,
    type: MaterialAccessTargetType,
    context: EntityAccessContext,
    student?: StudentEntity,
  ): Promise<void> {
    if (context.role === 'admin') {
      return;
    }

    if (context.role === 'teacher' && type === 'student') {
      const row =
        student ??
        (await this.studentRepo.findOne({ where: { userId: targetUserId } }));
      if (!row) {
        throw new ForbiddenException('Forbidden: student not found');
      }
      if (
        !context.ownedTeacherId ||
        row.assignedTeacher !== context.ownedTeacherId
      ) {
        throw new ForbiddenException(
          'Forbidden: can only manage access for assigned students',
        );
      }
      return;
    }

    throw new ForbiddenException('Forbidden: cannot manage this user');
  }

  private getAuditRole(context: EntityAccessContext): GrantedByRole {
    return context.role === 'admin' ? 'ADMIN' : 'TEACHER';
  }

  private async getManageableMaterialIds(
    context: EntityAccessContext,
  ): Promise<Set<string>> {
    const rows = await this.materialRepo.find({ select: ['id'] });
    const records = rows.map((row) => ({ id: row.id }));

    if (context.role === 'admin') {
      return new Set(records.map((r) => String(r.id)));
    }

    const filtered = await this.materialAccessCheck.filterReadableMaterials(
      context,
      records,
    );
    return new Set(filtered.map((r) => String(r.id)));
  }
}
