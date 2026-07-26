import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { normalizeRole } from '../constants/roles';
import { filterToEntityWhere } from '../utils/api-record.util';
import { AttendanceEntity } from '../../modules/lessons/entities/attendance.entity';
import { LessonEntity } from '../../modules/lessons/entities/lesson.entity';
import { NO_ACCESS_UUID } from './access.constants';
import { DomainAccessActor, TEACHER_LESSON_UPDATE_FIELDS } from './domain-access.types';
import { StudentAccessService } from './student-access.service';
import { TeacherAccessService } from './teacher-access.service';

@Injectable()
export class LessonAccessService {
  constructor(
    @InjectRepository(LessonEntity)
    private readonly lessonRepo: Repository<LessonEntity>,
    @InjectRepository(AttendanceEntity)
    private readonly attendanceRepo: Repository<AttendanceEntity>,
    private readonly studentAccess: StudentAccessService,
    private readonly teacherAccess: TeacherAccessService,
  ) {}

  isAdmin(actor: DomainAccessActor): boolean {
    return normalizeRole(actor.role) === 'admin';
  }

  async scopeLessonFilter(
    actor: DomainAccessActor,
    where: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (this.isAdmin(actor)) {
      return filterToEntityWhere(where);
    }

    const role = normalizeRole(actor.role);

    if (role === 'teacher') {
      const teacherId = await this.teacherAccess.resolveTeacherId(actor);
      if (!teacherId) {
        return { teacherId: NO_ACCESS_UUID };
      }
      return filterToEntityWhere({ ...where, teacher_id: teacherId });
    }

    if (role === 'student') {
      const studentId = await this.studentAccess.resolveStudentId(actor);
      if (!studentId) {
        return { id: NO_ACCESS_UUID };
      }

      const attendance = await this.attendanceRepo.find({ where: { studentId } });
      const lessonIds = [
        ...new Set([
          ...attendance.map((row) => row.lessonId),
          ...(await this.lessonRepo.find({ where: { primaryStudentId: studentId }, select: ['id'] })).map(
            (row) => row.id,
          ),
        ]),
      ];

      if (lessonIds.length === 0) {
        return { id: NO_ACCESS_UUID };
      }

      const scoped = filterToEntityWhere(where);
      if (scoped.id) {
        const requested = String(scoped.id);
        if (!lessonIds.includes(requested)) {
          return { id: NO_ACCESS_UUID };
        }
        return scoped;
      }

      return { ...scoped, id: In(lessonIds) };
    }

    throw new ForbiddenException('Forbidden');
  }

  async assertCanReadLesson(actor: DomainAccessActor, lessonId: string): Promise<LessonEntity> {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    if (this.isAdmin(actor)) {
      return lesson;
    }

    const role = normalizeRole(actor.role);
    if (role === 'teacher') {
      const teacherId = await this.teacherAccess.resolveTeacherId(actor);
      if (!teacherId || lesson.teacherId !== teacherId) {
        throw new ForbiddenException('Cannot access another teacher lesson');
      }
      return lesson;
    }

    if (role === 'student') {
      const studentId = await this.studentAccess.resolveStudentId(actor);
      if (!studentId) {
        throw new ForbiddenException('Forbidden');
      }

      if (lesson.primaryStudentId === studentId) {
        return lesson;
      }

      const attendance = await this.attendanceRepo.findOne({
        where: { lessonId, studentId },
      });
      if (!attendance) {
        throw new ForbiddenException('Cannot access another student lesson');
      }
      return lesson;
    }

    throw new ForbiddenException('Forbidden');
  }

  async assertCanWriteLesson<T extends Record<string, unknown>>(
    actor: DomainAccessActor,
    lessonId: string,
    dto?: T,
  ): Promise<Partial<T>> {
    await this.assertCanReadLesson(actor, lessonId);

    if (this.isAdmin(actor)) {
      return dto ?? {};
    }

    if (normalizeRole(actor.role) === 'teacher') {
      if (!dto) {
        return {};
      }
      return this.pickFields(dto, TEACHER_LESSON_UPDATE_FIELDS);
    }

    throw new ForbiddenException('Forbidden');
  }

  async scopeAttendanceFilter(
    actor: DomainAccessActor,
    where: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (this.isAdmin(actor)) {
      return filterToEntityWhere(where);
    }

    if (normalizeRole(actor.role) === 'student') {
      const studentId = await this.studentAccess.resolveStudentId(actor);
      if (!studentId) {
        return { studentId: NO_ACCESS_UUID };
      }
      return filterToEntityWhere({ ...where, student_id: studentId });
    }

    if (normalizeRole(actor.role) === 'teacher') {
      const teacherId = await this.teacherAccess.resolveTeacherId(actor);
      if (!teacherId) {
        return { lessonId: NO_ACCESS_UUID };
      }
      const lessons = await this.lessonRepo.find({
        where: { teacherId },
        select: ['id'],
      });
      const lessonIds = lessons.map((row) => row.id);
      if (lessonIds.length === 0) {
        return { lessonId: NO_ACCESS_UUID };
      }
      const owned = new Set(lessonIds);
      const scoped = filterToEntityWhere(where);
      if (scoped.lessonId != null) {
        const allowed = this.intersectOwnedLessonIds(scoped.lessonId, owned);
        if (allowed.length === 0) {
          return { lessonId: NO_ACCESS_UUID };
        }
        return {
          ...scoped,
          lessonId: allowed.length === 1 ? allowed[0] : In(allowed),
        };
      }
      return { ...scoped, lessonId: In(lessonIds) };
    }

    throw new ForbiddenException('Forbidden');
  }

  private intersectOwnedLessonIds(
    requested: unknown,
    owned: Set<string>,
  ): string[] {
    const ids: string[] = [];
    if (typeof requested === 'string') {
      ids.push(requested);
    } else if (Array.isArray(requested)) {
      for (const item of requested) {
        if (typeof item === 'string') ids.push(item);
      }
    } else if (
      requested &&
      typeof requested === 'object' &&
      '_value' in (requested as object)
    ) {
      const value = (requested as { _value?: unknown })._value;
      if (typeof value === 'string') {
        ids.push(value);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string') ids.push(item);
        }
      }
    }
    return ids.filter((id) => owned.has(id));
  }

  private pickFields<T extends Record<string, unknown>>(
    dto: T,
    allowed: readonly string[],
  ): Partial<T> {
    const out: Partial<T> = {};
    for (const key of allowed) {
      if (dto[key as keyof T] !== undefined) {
        out[key as keyof T] = dto[key as keyof T];
      }
    }
    return out;
  }
}
