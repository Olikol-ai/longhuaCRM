import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { normalizeRole } from '../../common/constants/roles';
import { JwtPayload } from '../auth/auth.service';
import { EnrollmentEntity } from '../courses/entities/enrollment.entity';
import { CourseTemplateEntity } from '../courses/entities/course-template.entity';
import { GroupEntity } from '../groups/entities/group.entity';
import { GroupMemberEntity } from '../groups/entities/group-member.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { TutorEntity } from '../tutors/entities/tutor.entity';
import { TutorStudentEntity } from '../tutors/entities/tutor-student.entity';
import { GrantedByRole, MaterialAccessEntity } from './entities/material-access.entity';
import { MaterialCourseGrantEntity } from './entities/material-course-grant.entity';
import { MaterialFolderEntity } from './entities/material-folder.entity';
import { MaterialGroupGrantEntity } from './entities/material-group-grant.entity';
import { MaterialEntity } from './entities/material.entity';
import {
  GrantMaterialAccessDto,
  MaterialAccessTargetType,
  RevokeMaterialAccessDto,
} from './dto/grant-material-access.dto';

export type MaterialAccessMutationResult = {
  success: true;
  grantedCount: number;
  revokedCount: number;
  skippedCount: number;
  message: string;
};

@Injectable()
export class MaterialAccessService {
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
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    @InjectRepository(TutorEntity)
    private readonly tutorRepo: Repository<TutorEntity>,
    @InjectRepository(TutorStudentEntity)
    private readonly tutorStudentRepo: Repository<TutorStudentEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepo: Repository<GroupEntity>,
    @InjectRepository(GroupMemberEntity)
    private readonly groupMemberRepo: Repository<GroupMemberEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepo: Repository<EnrollmentEntity>,
    @InjectRepository(CourseTemplateEntity)
    private readonly courseRepo: Repository<CourseTemplateEntity>,
  ) {}

  async grant(
    dto: GrantMaterialAccessDto,
    actor?: JwtPayload,
  ): Promise<MaterialAccessMutationResult> {
    await this.assertActorCanMutateTarget(actor, dto.targetType, dto.targetId);
    const materialIds = await this.assertActiveMaterials(dto.materialIds);
    await this.assertActorCanGrantMaterials(actor, materialIds);
    const role =
      dto.grantedByRole ??
      (normalizeRole(actor?.role) === 'tutor'
        ? 'TUTOR'
        : normalizeRole(actor?.role) === 'teacher'
          ? 'TEACHER'
          : 'ADMIN');

    switch (dto.targetType) {
      case 'user':
        return this.grantToUser(dto.targetId, materialIds, role);
      case 'student':
        return this.grantToStudent(dto.targetId, materialIds, role);
      case 'tutor_student':
        return this.grantToTutorStudent(dto.targetId, materialIds, role);
      case 'group':
        return this.grantToGroup(dto.targetId, materialIds, role);
      case 'course':
        return this.grantToCourse(dto.targetId, materialIds, role);
      default:
        throw new BadRequestException('Неизвестный тип получателя доступа');
    }
  }

  /**
   * Explicit grants stored for a material (not inferred enrollment/folder access).
   */
  async listGrantsForMaterial(materialId: string): Promise<{
    material_id: string;
    user_ids: string[];
    tutor_student_ids: string[];
    group_ids: string[];
    course_template_ids: string[];
    personal: Array<{
      user_id: string | null;
      student_id: string | null;
      tutor_student_id: string | null;
      name: string;
      email: string;
      source: 'personal';
      label: string;
      revocable: true;
    }>;
    groups: Array<{
      group_id: string;
      name: string;
      source: 'group';
      label: string;
      revocable: true;
    }>;
    courses: Array<{
      course_template_id: string;
      name: string;
      source: 'course';
      label: string;
      revocable: true;
    }>;
    folder_course: {
      course_template_id: string;
      name: string;
      source: 'course';
      label: string;
      revocable: false;
      note: string;
    } | null;
  }> {
    const material = await this.materialRepo.findOne({ where: { id: materialId } });
    if (!material || material.status === 'deleted') {
      throw new NotFoundException('Material not found');
    }

    const [personalRows, groupRows, courseRows] = await Promise.all([
      this.accessRepo.find({
        where: { materialId, access: true },
        select: ['userId', 'tutorStudentId'],
      }),
      this.groupGrantRepo.find({
        where: { materialId },
        select: ['groupId'],
      }),
      this.courseGrantRepo.find({
        where: { materialId },
        select: ['courseTemplateId'],
      }),
    ]);

    const userIds = personalRows
      .map((row) => row.userId)
      .filter((id): id is string => Boolean(id));
    const tutorStudentIds = personalRows
      .map((row) => row.tutorStudentId)
      .filter((id): id is string => Boolean(id));
    const groupIds = groupRows.map((row) => row.groupId);
    const courseIds = courseRows.map((row) => row.courseTemplateId);

    const students =
      userIds.length > 0
        ? await this.studentRepo.find({ where: { userId: In(userIds) } })
        : [];
    const studentByUser = new Map(
      students.filter((row) => row.userId).map((row) => [row.userId as string, row]),
    );

    const tutorStudents =
      tutorStudentIds.length > 0
        ? await this.tutorStudentRepo.find({ where: { id: In(tutorStudentIds) } })
        : [];
    const tutorStudentById = new Map(tutorStudents.map((row) => [row.id, row]));

    const groups =
      groupIds.length > 0
        ? await this.groupRepo.find({ where: { id: In(groupIds) } })
        : [];
    const groupById = new Map(groups.map((row) => [row.id, row]));

    const courses =
      courseIds.length > 0
        ? await this.courseRepo.find({ where: { id: In(courseIds) } })
        : [];
    const courseById = new Map(courses.map((row) => [row.id, row]));

    let folderCourse: {
      course_template_id: string;
      name: string;
      source: 'course';
      label: string;
      revocable: false;
      note: string;
    } | null = null;

    if (material.folderId) {
      const folder = await this.folderRepo.findOne({ where: { id: material.folderId } });
      if (folder?.courseTemplateId) {
        const folderCourseEntity =
          courseById.get(folder.courseTemplateId)
          ?? (await this.courseRepo.findOne({ where: { id: folder.courseTemplateId } }));
        folderCourse = {
          course_template_id: folder.courseTemplateId,
          name: folderCourseEntity?.name ?? 'Курс',
          source: 'course',
          label: 'Доступ через курс',
          revocable: false,
          note: 'Материал в папке курса — зачисленные ученики видят его без отдельного гранта.',
        };
      }
    }

    return {
      material_id: materialId,
      user_ids: userIds,
      tutor_student_ids: tutorStudentIds,
      group_ids: groupIds,
      course_template_ids: courseIds,
      personal: personalRows.map((row) => {
        const tutorStudent = row.tutorStudentId
          ? tutorStudentById.get(row.tutorStudentId)
          : undefined;
        const student = row.userId ? studentByUser.get(row.userId) : undefined;
        return {
          user_id: row.userId,
          student_id: student?.id ?? null,
          tutor_student_id: row.tutorStudentId,
          name:
            tutorStudent?.name ||
            student?.name ||
            student?.email ||
            row.userId ||
            row.tutorStudentId ||
            'Ученик',
          email: tutorStudent?.email || student?.email || '',
          source: 'personal' as const,
          label: tutorStudent
            ? 'Персональный доступ (ученик репетитора)'
            : 'Персональный доступ',
          revocable: true as const,
        };
      }),
      groups: groupIds.map((groupId) => ({
        group_id: groupId,
        name: groupById.get(groupId)?.name ?? groupId,
        source: 'group' as const,
        label: 'Доступ через группу',
        revocable: true as const,
      })),
      courses: courseIds.map((courseTemplateId) => ({
        course_template_id: courseTemplateId,
        name: courseById.get(courseTemplateId)?.name ?? courseTemplateId,
        source: 'course' as const,
        label: 'Доступ через курс',
        revocable: true as const,
      })),
      folder_course: folderCourse,
    };
  }

  async revoke(
    dto: RevokeMaterialAccessDto,
    actor?: JwtPayload,
  ): Promise<MaterialAccessMutationResult> {
    await this.assertActorCanMutateTarget(actor, dto.targetType, dto.targetId);
    const materialIds = [...new Set(dto.materialIds)];
    if (materialIds.length === 0) {
      throw new BadRequestException('Укажите материалы');
    }

    switch (dto.targetType) {
      case 'user':
        return this.revokeFromUser(dto.targetId, materialIds);
      case 'student':
        return this.revokeFromStudent(dto.targetId, materialIds);
      case 'tutor_student':
        return this.revokeFromTutorStudent(dto.targetId, materialIds);
      case 'group':
        return this.revokeFromGroup(dto.targetId, materialIds);
      case 'course':
        return this.revokeFromCourse(dto.targetId, materialIds);
      default:
        throw new BadRequestException('Неизвестный тип получателя доступа');
    }
  }

  async syncUserAccess(
    userId: string,
    materialIds: string[],
    grantedByRole: GrantedByRole = 'ADMIN',
  ): Promise<{ grantedCount: number; revokedCount: number }> {
    const requested = new Set(await this.assertActiveMaterials(materialIds));
    const currentRows = await this.accessRepo.find({ where: { userId } });
    const currentGranted = new Set(
      currentRows.filter((row) => row.access).map((row) => row.materialId),
    );

    let grantedCount = 0;
    let revokedCount = 0;

    for (const materialId of requested) {
      if (!currentGranted.has(materialId)) {
        await this.upsertPersonalAccess(userId, materialId, true, grantedByRole);
        grantedCount += 1;
      }
    }

    for (const materialId of currentGranted) {
      if (!requested.has(materialId)) {
        await this.upsertPersonalAccess(userId, materialId, false, grantedByRole);
        revokedCount += 1;
      }
    }

    return { grantedCount, revokedCount };
  }

  async getUserAccessEditor(userId: string): Promise<{
    user_id: string;
    courses: Array<{
      id: string;
      course_name: string;
      materials: Array<{ id: string; title: string; granted: boolean; has_access: boolean }>;
    }>;
  }> {
    const folders = await this.folderRepo.find();
    const folderCourse = new Map(
      folders.map((folder) => [folder.id, folder.courseTemplateId]),
    );
    const materials = await this.materialRepo.find({ where: { status: 'active' } });
    const personal = await this.accessRepo.find({ where: { userId, access: true } });
    const grantedIds = new Set(personal.map((row) => row.materialId));

    const courses = await this.courseRepo.find();
    const byCourse = new Map<
      string,
      { id: string; course_name: string; materials: Array<{ id: string; title: string; granted: boolean; has_access: boolean }> }
    >();

    for (const course of courses) {
      byCourse.set(course.id, {
        id: course.id,
        course_name: course.name,
        materials: [],
      });
    }

    const uncategorizedId = 'uncategorized';
    byCourse.set(uncategorizedId, {
      id: uncategorizedId,
      course_name: 'Без курса',
      materials: [],
    });

    for (const material of materials) {
      const courseId = folderCourse.get(material.folderId) ?? uncategorizedId;
      const bucket = byCourse.get(courseId) ?? byCourse.get(uncategorizedId)!;
      const granted = grantedIds.has(material.id);
      bucket.materials.push({
        id: material.id,
        title: material.title,
        granted,
        has_access: granted,
      });
    }

    return {
      user_id: userId,
      courses: [...byCourse.values()].filter((course) => course.materials.length > 0),
    };
  }

  async resolveAccessibleMaterialIdsForUser(
    userId: string,
    role?: string,
  ): Promise<string[]> {
    if (role === 'admin') {
      const all = await this.materialRepo.find({
        where: { status: 'active' },
        select: ['id'],
      });
      return all.map((row) => row.id);
    }

    const ids = new Set<string>();

    const personal = await this.accessRepo.find({
      where: { userId, access: true },
      select: ['materialId'],
    });
    for (const row of personal) {
      ids.add(row.materialId);
    }

    const student = await this.studentRepo.findOne({ where: { userId } });
    if (student) {
      const enrollments = await this.enrollmentRepo.find({
        where: { studentId: student.id },
        select: ['courseTemplateId'],
      });
      const courseIds = [
        ...new Set(
          enrollments
            .map((row) => row.courseTemplateId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      if (courseIds.length > 0) {
        const courseGrants = await this.courseGrantRepo.find({
          where: { courseTemplateId: In(courseIds) },
          select: ['materialId'],
        });
        for (const row of courseGrants) {
          ids.add(row.materialId);
        }

        // Materials physically placed in enrolled course folders.
        const folders = await this.folderRepo.find({
          where: { courseTemplateId: In(courseIds) },
          select: ['id'],
        });
        const folderIds = folders.map((folder) => folder.id);
        if (folderIds.length > 0) {
          const folderMaterials = await this.materialRepo.find({
            where: { folderId: In(folderIds), status: 'active' },
            select: ['id'],
          });
          for (const row of folderMaterials) {
            ids.add(row.id);
          }
        }
      }

      const memberships = await this.groupMemberRepo.find({
        where: { studentId: student.id },
        select: ['groupId'],
      });
      const groupIds = memberships.map((row) => row.groupId);
      if (groupIds.length > 0) {
        const groupGrants = await this.groupGrantRepo.find({
          where: { groupId: In(groupIds) },
          select: ['materialId'],
        });
        for (const row of groupGrants) {
          ids.add(row.materialId);
        }
      }
    }

    if (role === 'teacher') {
      const teacher = await this.teacherRepo.findOne({ where: { userId } });
      if (teacher) {
        const groups = await this.groupRepo.find({
          where: { teacherId: teacher.id },
          select: ['id'],
        });
        const groupIds = groups.map((row) => row.id);
        if (groupIds.length > 0) {
          const groupGrants = await this.groupGrantRepo.find({
            where: { groupId: In(groupIds) },
            select: ['materialId'],
          });
          for (const row of groupGrants) {
            ids.add(row.materialId);
          }
        }

        const assignedStudents = await this.studentRepo.find({
          where: { assignedTeacherId: teacher.id },
          select: ['id'],
        });
        if (assignedStudents.length > 0) {
          const enrollments = await this.enrollmentRepo.find({
            where: { studentId: In(assignedStudents.map((row) => row.id)) },
            select: ['courseTemplateId'],
          });
          const courseIds = [
            ...new Set(
              enrollments
                .map((row) => row.courseTemplateId)
                .filter((id): id is string => Boolean(id)),
            ),
          ];
          if (courseIds.length > 0) {
            const courseGrants = await this.courseGrantRepo.find({
              where: { courseTemplateId: In(courseIds) },
              select: ['materialId'],
            });
            for (const row of courseGrants) {
              ids.add(row.materialId);
            }
            const folders = await this.folderRepo.find({
              where: { courseTemplateId: In(courseIds) },
              select: ['id'],
            });
            const folderIds = folders.map((folder) => folder.id);
            if (folderIds.length > 0) {
              const folderMaterials = await this.materialRepo.find({
                where: { folderId: In(folderIds), status: 'active' },
                select: ['id'],
              });
              for (const row of folderMaterials) {
                ids.add(row.id);
              }
            }
          }
        }
      }
    }

    if (role === 'tutor') {
      const owned = await this.materialRepo.find({
        where: { createdByUserId: userId, status: 'active' },
        select: ['id'],
      });
      for (const row of owned) {
        ids.add(row.id);
      }
    }

    if (role === 'tutor_student') {
      const tutorStudents = await this.tutorStudentRepo.find({
        where: { userId },
        select: ['id'],
      });
      if (tutorStudents.length > 0) {
        const viaTutorStudent = await this.accessRepo.find({
          where: {
            tutorStudentId: In(tutorStudents.map((row) => row.id)),
            access: true,
          },
          select: ['materialId'],
        });
        for (const row of viaTutorStudent) {
          ids.add(row.materialId);
        }
      }
    }

    if (ids.size === 0) {
      return [];
    }

    const active = await this.materialRepo.find({
      where: { id: In([...ids]), status: 'active' },
      select: ['id'],
    });
    return active.map((row) => row.id);
  }

  async canUserAccessMaterial(
    userId: string,
    materialId: string,
    role?: string,
  ): Promise<boolean> {
    if (role === 'admin') {
      return true;
    }
    const material = await this.materialRepo.findOne({ where: { id: materialId } });
    if (!material || material.status === 'deleted') {
      return false;
    }
    const ids = await this.resolveAccessibleMaterialIdsForUser(userId, role);
    return ids.includes(materialId);
  }

  private async grantToStudent(
    studentId: string,
    materialIds: string[],
    role: GrantedByRole,
  ): Promise<MaterialAccessMutationResult> {
    const student = await this.studentRepo.findOne({ where: { id: studentId } });
    if (!student) {
      throw new NotFoundException('Ученик не найден');
    }
    if (!student.userId) {
      throw new BadRequestException(
        'У ученика нет привязанного аккаунта. Привяжите пользователя перед выдачей доступа.',
      );
    }
    return this.grantToUser(student.userId, materialIds, role);
  }

  private async revokeFromStudent(
    studentId: string,
    materialIds: string[],
  ): Promise<MaterialAccessMutationResult> {
    const student = await this.studentRepo.findOne({ where: { id: studentId } });
    if (!student?.userId) {
      throw new NotFoundException('Ученик или аккаунт ученика не найден');
    }
    return this.revokeFromUser(student.userId, materialIds);
  }

  private async grantToTutorStudent(
    tutorStudentId: string,
    materialIds: string[],
    role: GrantedByRole,
  ): Promise<MaterialAccessMutationResult> {
    const tutorStudent = await this.tutorStudentRepo.findOne({
      where: { id: tutorStudentId },
    });
    if (!tutorStudent || tutorStudent.status === 'inactive') {
      throw new NotFoundException('Ученик репетитора не найден');
    }

    let grantedCount = 0;
    let skippedCount = 0;
    for (const materialId of materialIds) {
      const existing = await this.findTutorStudentAccess(tutorStudentId, materialId);
      if (existing?.access) {
        if (tutorStudent.userId && existing.userId !== tutorStudent.userId) {
          existing.userId = tutorStudent.userId;
          await this.accessRepo.save(existing);
        }
        skippedCount += 1;
        continue;
      }
      await this.upsertTutorStudentAccess(tutorStudent, materialId, true, role);
      grantedCount += 1;
    }

    return {
      success: true,
      grantedCount,
      revokedCount: 0,
      skippedCount,
      message:
        grantedCount > 0
          ? `Доступ выдан (${grantedCount}).`
          : 'Доступ уже был выдан ранее.',
    };
  }

  private async revokeFromTutorStudent(
    tutorStudentId: string,
    materialIds: string[],
  ): Promise<MaterialAccessMutationResult> {
    const tutorStudent = await this.tutorStudentRepo.findOne({
      where: { id: tutorStudentId },
    });
    if (!tutorStudent) {
      throw new NotFoundException('Ученик репетитора не найден');
    }

    let revokedCount = 0;
    let skippedCount = 0;
    for (const materialId of materialIds) {
      const existing = await this.findTutorStudentAccess(tutorStudentId, materialId);
      if (!existing?.access) {
        skippedCount += 1;
        continue;
      }
      await this.upsertTutorStudentAccess(
        tutorStudent,
        materialId,
        false,
        existing.grantedByRole,
      );
      revokedCount += 1;
    }

    return {
      success: true,
      grantedCount: 0,
      revokedCount,
      skippedCount,
      message:
        revokedCount > 0
          ? `Доступ отозван (${revokedCount}).`
          : 'Активный доступ не найден.',
    };
  }

  /**
   * After a local tutor student registers and links to a user, attach user_id
   * on existing MaterialAccess rows so grants survive automatically.
   */
  async attachUserIdToTutorStudentGrants(
    tutorStudentId: string,
    userId: string,
  ): Promise<number> {
    const result = await this.accessRepo.update({ tutorStudentId }, { userId });
    return result.affected ?? 0;
  }

  /**
   * Grant personal material_access rows (used on material create for the creator).
   */
  async grantPersonalAccess(
    userId: string,
    materialIds: string[],
    role: GrantedByRole,
  ): Promise<MaterialAccessMutationResult> {
    return this.grantToUser(userId, materialIds, role);
  }

  private async grantToUser(
    userId: string,
    materialIds: string[],
    role: GrantedByRole,
  ): Promise<MaterialAccessMutationResult> {
    let grantedCount = 0;
    let skippedCount = 0;
    for (const materialId of materialIds) {
      const existing = await this.accessRepo.findOne({ where: { userId, materialId } });
      if (existing?.access) {
        skippedCount += 1;
        continue;
      }
      await this.upsertPersonalAccess(userId, materialId, true, role);
      grantedCount += 1;
    }
    return {
      success: true,
      grantedCount,
      revokedCount: 0,
      skippedCount,
      message:
        grantedCount > 0
          ? `Доступ выдан (${grantedCount}).`
          : 'Доступ уже был выдан ранее.',
    };
  }

  private async revokeFromUser(
    userId: string,
    materialIds: string[],
  ): Promise<MaterialAccessMutationResult> {
    let revokedCount = 0;
    let skippedCount = 0;
    for (const materialId of materialIds) {
      const existing = await this.accessRepo.findOne({ where: { userId, materialId } });
      if (!existing?.access) {
        skippedCount += 1;
        continue;
      }
      await this.upsertPersonalAccess(userId, materialId, false, existing.grantedByRole);
      revokedCount += 1;
    }
    return {
      success: true,
      grantedCount: 0,
      revokedCount,
      skippedCount,
      message: revokedCount > 0 ? `Доступ отозван (${revokedCount}).` : 'Активный доступ не найден.',
    };
  }

  private async grantToGroup(
    groupId: string,
    materialIds: string[],
    role: GrantedByRole,
  ): Promise<MaterialAccessMutationResult> {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException('Группа не найдена');
    }

    let grantedCount = 0;
    let skippedCount = 0;
    for (const materialId of materialIds) {
      const existing = await this.groupGrantRepo.findOne({ where: { groupId, materialId } });
      if (existing) {
        skippedCount += 1;
        continue;
      }
      await this.groupGrantRepo.save(
        this.groupGrantRepo.create({ groupId, materialId, grantedByRole: role }),
      );
      grantedCount += 1;
    }

    return {
      success: true,
      grantedCount,
      revokedCount: 0,
      skippedCount,
      message:
        grantedCount > 0
          ? `Доступ группе выдан (${grantedCount}). Участники увидят материалы.`
          : 'Доступ группе уже был выдан.',
    };
  }

  private async revokeFromGroup(
    groupId: string,
    materialIds: string[],
  ): Promise<MaterialAccessMutationResult> {
    const result = await this.groupGrantRepo.delete({
      groupId,
      materialId: In(materialIds),
    });
    const revokedCount = result.affected ?? 0;
    return {
      success: true,
      grantedCount: 0,
      revokedCount,
      skippedCount: Math.max(0, materialIds.length - revokedCount),
      message: revokedCount > 0 ? `Доступ группы отозван (${revokedCount}).` : 'Гранты группы не найдены.',
    };
  }

  private async grantToCourse(
    courseTemplateId: string,
    materialIds: string[],
    role: GrantedByRole,
  ): Promise<MaterialAccessMutationResult> {
    const course = await this.courseRepo.findOne({ where: { id: courseTemplateId } });
    if (!course) {
      throw new NotFoundException('Курс не найден');
    }
    if (!course.isActive) {
      throw new BadRequestException('Курс архивирован — доступ выдать нельзя');
    }

    let grantedCount = 0;
    let skippedCount = 0;
    for (const materialId of materialIds) {
      const existing = await this.courseGrantRepo.findOne({
        where: { courseTemplateId, materialId },
      });
      if (existing) {
        skippedCount += 1;
        continue;
      }
      await this.courseGrantRepo.save(
        this.courseGrantRepo.create({
          courseTemplateId,
          materialId,
          grantedByRole: role,
        }),
      );
      grantedCount += 1;
    }

    return {
      success: true,
      grantedCount,
      revokedCount: 0,
      skippedCount,
      message:
        grantedCount > 0
          ? `Доступ курсу выдан (${grantedCount}). Зачисленные ученики увидят материалы.`
          : 'Доступ курсу уже был выдан.',
    };
  }

  private async revokeFromCourse(
    courseTemplateId: string,
    materialIds: string[],
  ): Promise<MaterialAccessMutationResult> {
    const result = await this.courseGrantRepo.delete({
      courseTemplateId,
      materialId: In(materialIds),
    });
    const revokedCount = result.affected ?? 0;
    return {
      success: true,
      grantedCount: 0,
      revokedCount,
      skippedCount: Math.max(0, materialIds.length - revokedCount),
      message: revokedCount > 0 ? `Доступ курса отозван (${revokedCount}).` : 'Гранты курса не найдены.',
    };
  }

  private async upsertPersonalAccess(
    userId: string,
    materialId: string,
    access: boolean,
    grantedByRole: GrantedByRole,
  ): Promise<void> {
    const existing = await this.accessRepo.findOne({ where: { userId, materialId } });
    if (existing) {
      existing.access = access;
      existing.grantedByRole = grantedByRole;
      await this.accessRepo.save(existing);
      return;
    }
    await this.accessRepo.save(
      this.accessRepo.create({
        userId,
        tutorStudentId: null,
        materialId,
        access,
        grantedByRole,
      }),
    );
  }

  private async findTutorStudentAccess(
    tutorStudentId: string,
    materialId: string,
  ): Promise<MaterialAccessEntity | null> {
    return this.accessRepo.findOne({ where: { tutorStudentId, materialId } });
  }

  private async upsertTutorStudentAccess(
    tutorStudent: TutorStudentEntity,
    materialId: string,
    access: boolean,
    grantedByRole: GrantedByRole,
  ): Promise<void> {
    const existing = await this.findTutorStudentAccess(tutorStudent.id, materialId);
    if (existing) {
      existing.access = access;
      existing.grantedByRole = grantedByRole;
      existing.tutorStudentId = tutorStudent.id;
      if (tutorStudent.userId) {
        existing.userId = tutorStudent.userId;
      }
      await this.accessRepo.save(existing);
      return;
    }
    await this.accessRepo.save(
      this.accessRepo.create({
        userId: tutorStudent.userId,
        tutorStudentId: tutorStudent.id,
        materialId,
        access,
        grantedByRole,
      }),
    );
  }

  /**
   * Teachers may only grant/revoke for their assigned students / own groups.
   * Tutors may only grant/revoke for their own tutor_students.
   * Course-wide grants stay admin-only.
   */
  private async assertActorCanMutateTarget(
    actor: JwtPayload | undefined,
    targetType: MaterialAccessTargetType,
    targetId: string,
  ): Promise<void> {
    if (!actor || normalizeRole(actor.role) === 'admin') {
      return;
    }

    const role = normalizeRole(actor.role);

    if (role === 'tutor') {
      if (targetType === 'course' || targetType === 'group' || targetType === 'student') {
        throw new ForbiddenException(
          'Репетитор может выдавать доступ только своим ученикам',
        );
      }

      const tutor = await this.tutorRepo.findOne({ where: { userId: actor.sub } });
      if (!tutor) {
        throw new ForbiddenException('Профиль репетитора не найден');
      }

      if (targetType === 'tutor_student') {
        const tutorStudent = await this.tutorStudentRepo.findOne({
          where: { id: targetId },
        });
        if (!tutorStudent || tutorStudent.tutorId !== tutor.id) {
          throw new ForbiddenException('Можно выдавать доступ только своим ученикам');
        }
        return;
      }

      if (targetType === 'user') {
        const tutorStudent = await this.tutorStudentRepo.findOne({
          where: { userId: targetId, tutorId: tutor.id },
        });
        if (!tutorStudent) {
          throw new ForbiddenException('Можно выдавать доступ только своим ученикам');
        }
        return;
      }

      throw new ForbiddenException('Недостаточно прав для изменения доступа');
    }

    if (role !== 'teacher') {
      throw new ForbiddenException('Недостаточно прав для изменения доступа');
    }

    const teacher = await this.teacherRepo.findOne({ where: { userId: actor.sub } });
    if (!teacher) {
      throw new ForbiddenException('Профиль преподавателя не найден');
    }

    if (targetType === 'course') {
      throw new ForbiddenException(
        'Выдавать доступ через курс может только администратор',
      );
    }

    if (targetType === 'tutor_student') {
      throw new ForbiddenException(
        'Преподаватель не может выдавать материалы ученикам репетитора',
      );
    }

    if (targetType === 'student') {
      const student = await this.studentRepo.findOne({ where: { id: targetId } });
      if (!student || student.assignedTeacherId !== teacher.id) {
        throw new ForbiddenException('Можно выдавать доступ только своим ученикам');
      }
      return;
    }

    if (targetType === 'user') {
      const student = await this.studentRepo.findOne({ where: { userId: targetId } });
      if (!student || student.assignedTeacherId !== teacher.id) {
        throw new ForbiddenException('Можно выдавать доступ только своим ученикам');
      }
      return;
    }

    if (targetType === 'group') {
      const group = await this.groupRepo.findOne({ where: { id: targetId } });
      if (!group || group.teacherId !== teacher.id) {
        throw new ForbiddenException('Можно выдавать доступ только своим группам');
      }
    }
  }

  /**
   * Tutors may grant only materials they created.
   */
  private async assertActorCanGrantMaterials(
    actor: JwtPayload | undefined,
    materialIds: string[],
  ): Promise<void> {
    if (!actor || normalizeRole(actor.role) === 'admin') {
      return;
    }
    if (normalizeRole(actor.role) !== 'tutor') {
      return;
    }
    const rows = await this.materialRepo.find({
      where: { id: In(materialIds), status: 'active' },
      select: ['id', 'createdByUserId'],
    });
    if (rows.some((row) => row.createdByUserId !== actor.sub)) {
      throw new ForbiddenException('Можно выдавать доступ только к своим материалам');
    }
  }

  private async assertActiveMaterials(materialIds: string[]): Promise<string[]> {
    const unique = [...new Set(materialIds)];
    if (unique.length === 0) {
      throw new BadRequestException('Укажите хотя бы один материал');
    }
    const rows = await this.materialRepo.find({
      where: { id: In(unique), status: 'active' },
      select: ['id'],
    });
    if (rows.length !== unique.length) {
      throw new NotFoundException('Один или несколько материалов не найдены или удалены');
    }
    return unique;
  }
}
