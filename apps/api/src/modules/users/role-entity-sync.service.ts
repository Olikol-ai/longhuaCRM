import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager, Repository } from 'typeorm';
import { filterToEntityWhere } from '../../common/utils/api-record.util';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { TutorEntity } from '../tutors/entities/tutor.entity';
import { TutorStudentEntity } from '../tutors/entities/tutor-student.entity';
import {
  composeDisplayName,
  resolveNameParts,
} from './display-name.util';
import { UserEntity } from './entities/user.entity';

export type RoleEntityUserContext = Pick<
  UserEntity,
  'id' | 'email' | 'firstName' | 'lastName' | 'phone'
>;

@Injectable()
export class RoleEntitySyncService {
  constructor(
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    @InjectRepository(TutorEntity)
    private readonly tutorRepo: Repository<TutorEntity>,
    @InjectRepository(TutorStudentEntity)
    private readonly tutorStudentRepo: Repository<TutorStudentEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /**
   * @param manager Optional transaction manager — when set, all writes participate in that txn.
   */
  async syncAfterRoleChange(
    user: RoleEntityUserContext,
    newRole: string,
    manager?: EntityManager,
    options?: { assignedTeacherId?: string | null; assignedTutorId?: string | null },
  ): Promise<void> {
    const role = newRole.trim().toLowerCase();
    const studentRepo = manager?.getRepository(StudentEntity) ?? this.studentRepo;
    const teacherRepo = manager?.getRepository(TeacherEntity) ?? this.teacherRepo;
    const tutorRepo = manager?.getRepository(TutorEntity) ?? this.tutorRepo;
    const tutorStudentRepo =
      manager?.getRepository(TutorStudentEntity) ?? this.tutorStudentRepo;

    if (role === 'student') {
      await this.detachTeachersForUser(teacherRepo, user.id);
      await this.detachTutorsForUser(tutorRepo, user.id);
      await this.detachTutorStudentsForUser(tutorStudentRepo, user.id);
      await this.ensureStudentProfile(studentRepo, user, {
        assignedTeacherId: options?.assignedTeacherId,
        applyTeacherAssignment: Object.prototype.hasOwnProperty.call(
          options ?? {},
          'assignedTeacherId',
        ),
      });
      return;
    }

    if (role === 'tutor_student') {
      await this.detachStudentsForUser(studentRepo, user.id);
      await this.detachTeachersForUser(teacherRepo, user.id);
      await this.detachTutorsForUser(tutorRepo, user.id);
      await this.ensureTutorStudentProfile(
        tutorStudentRepo,
        user,
        options?.assignedTutorId ?? null,
        manager,
      );
      return;
    }

    if (role === 'teacher') {
      await this.detachStudentsForUser(studentRepo, user.id);
      await this.detachTutorsForUser(tutorRepo, user.id);
      await this.detachTutorStudentsForUser(tutorStudentRepo, user.id);
      await this.ensureTeacherProfile(teacherRepo, user);
      return;
    }

    if (role === 'tutor') {
      await this.detachStudentsForUser(studentRepo, user.id);
      await this.detachTeachersForUser(teacherRepo, user.id);
      await this.detachTutorStudentsForUser(tutorStudentRepo, user.id);
      await this.ensureTutorProfile(tutorRepo, user);
      return;
    }

    if (role === 'admin' || role === 'pending' || role === 'user' || role === '') {
      await this.detachTeachersForUser(teacherRepo, user.id);
      await this.detachTutorsForUser(tutorRepo, user.id);
      await this.detachStudentsForUser(studentRepo, user.id);
      await this.detachTutorStudentsForUser(tutorStudentRepo, user.id);
    }
  }

  async upsertStudentFromCreate(input: Record<string, unknown>): Promise<StudentEntity> {
    const payload = filterToEntityWhere(input) as Partial<StudentEntity>;
    const userId = this.normalizeId(payload.userId);
    const email = this.normalizeEmail(payload.email);

    if (userId) {
      const existing = await this.studentRepo.findOne({ where: { userId } });
      if (existing) {
        return this.saveStudent(this.studentRepo, existing, payload);
      }
    }

    if (email) {
      const byEmail = await this.studentRepo.findOne({ where: { email } });
      if (byEmail && (!byEmail.userId || byEmail.userId === userId)) {
        return this.saveStudent(this.studentRepo, byEmail, {
          ...payload,
          userId: userId ?? byEmail.userId,
        });
      }
    }

    return this.insertStudent(this.studentRepo, payload, input.id);
  }

  async upsertTeacherFromCreate(input: Record<string, unknown>): Promise<TeacherEntity> {
    const payload = filterToEntityWhere(input) as Partial<TeacherEntity>;
    const userId = this.normalizeId(payload.userId);
    const email = this.normalizeEmail(payload.email);

    if (userId) {
      const existing = await this.teacherRepo.findOne({ where: { userId } });
      if (existing) {
        return this.saveTeacher(this.teacherRepo, existing, payload);
      }
    }

    if (email) {
      const byEmail = await this.teacherRepo.findOne({ where: { email } });
      if (byEmail && (!byEmail.userId || byEmail.userId === userId)) {
        return this.saveTeacher(this.teacherRepo, byEmail, {
          ...payload,
          userId: userId ?? byEmail.userId,
        });
      }
    }

    return this.insertTeacher(this.teacherRepo, payload, input.id);
  }

  /**
   * After admin/teacher edits a Student profile name, keep linked User in sync.
   * User.firstName/lastName power /auth/me, Profile, and greetings.
   */
  async syncLinkedUserFromStudent(student: StudentEntity): Promise<void> {
    if (!student.userId) {
      return;
    }

    // Student.name is SSOT — never let stale first/last overwrite the display name.
    const parts = resolveNameParts({
      name: student.name,
      firstName: student.firstName,
      lastName: student.lastName,
      emailFallback: student.email,
      nameIsSource: Boolean(String(student.name ?? '').trim()),
    });

    const user = await this.userRepo.findOne({ where: { id: student.userId } });
    if (!user) {
      return;
    }

    let changed = false;
    if (parts.firstName && user.firstName !== parts.firstName) {
      user.firstName = parts.firstName;
      changed = true;
    }
    if (parts.lastName && user.lastName !== parts.lastName) {
      user.lastName = parts.lastName;
      changed = true;
    }
    if (changed) {
      user.updatedDate = new Date();
      await this.userRepo.save(user);
    }
  }

  /**
   * After admin edits a Teacher profile name, keep linked User in sync.
   */
  async syncLinkedUserFromTeacher(teacher: TeacherEntity): Promise<void> {
    if (!teacher.userId) {
      return;
    }

    const parts = resolveNameParts({
      name: teacher.name,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      emailFallback: teacher.email,
    });

    const user = await this.userRepo.findOne({ where: { id: teacher.userId } });
    if (!user) {
      return;
    }

    let changed = false;
    if (parts.firstName && user.firstName !== parts.firstName) {
      user.firstName = parts.firstName;
      changed = true;
    }
    if (parts.lastName && user.lastName !== parts.lastName) {
      user.lastName = parts.lastName;
      changed = true;
    }
    if (changed) {
      user.updatedDate = new Date();
      await this.userRepo.save(user);
    }
  }

  /**
   * After admin edits a Tutor profile display name, keep linked User in sync.
   */
  async syncLinkedUserFromTutor(tutor: TutorEntity): Promise<void> {
    if (!tutor.userId) {
      return;
    }

    const parts = resolveNameParts({
      name: tutor.displayName,
      emailFallback: tutor.email,
      nameIsSource: true,
    });

    const user = await this.userRepo.findOne({ where: { id: tutor.userId } });
    if (!user) {
      return;
    }

    let changed = false;
    if (parts.firstName && user.firstName !== parts.firstName) {
      user.firstName = parts.firstName;
      changed = true;
    }
    if (parts.lastName !== undefined && user.lastName !== parts.lastName) {
      user.lastName = parts.lastName;
      changed = true;
    }
    if (changed) {
      user.updatedDate = new Date();
      await this.userRepo.save(user);
    }
  }

  /**
   * After User name changes (/auth/me or admin Users), push into role profiles.
   */
  async syncLinkedProfilesFromUser(user: RoleEntityUserContext): Promise<void> {
    const display = this.displayName(user);
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    const phone = (user.phone ?? '').trim();
    const email = (user.email ?? '').trim();

    const student = await this.studentRepo.findOne({ where: { userId: user.id } });
    if (student) {
      student.name = display;
      student.firstName = firstName || student.firstName;
      student.lastName = lastName || student.lastName;
      if (email) student.email = email;
      if (phone !== undefined) student.phone = phone || null;
      await this.studentRepo.save(student);
    }

    const teacher = await this.teacherRepo.findOne({ where: { userId: user.id } });
    if (teacher) {
      teacher.name = display;
      teacher.firstName = firstName || teacher.firstName;
      teacher.lastName = lastName || teacher.lastName;
      if (email) teacher.email = email;
      if (phone !== undefined) teacher.phone = phone || null;
      await this.teacherRepo.save(teacher);
    }

    const tutor = await this.tutorRepo.findOne({ where: { userId: user.id } });
    if (tutor) {
      tutor.displayName = display;
      if (email) tutor.email = email;
      if (phone !== undefined) tutor.phone = phone || null;
      await this.tutorRepo.save(tutor);
    }

    const tutorStudent = await this.tutorStudentRepo.findOne({ where: { userId: user.id } });
    if (tutorStudent) {
      tutorStudent.name = display;
      tutorStudent.firstName = firstName || tutorStudent.firstName;
      tutorStudent.lastName = lastName || tutorStudent.lastName;
      if (email) tutorStudent.email = email;
      if (phone !== undefined) tutorStudent.phone = phone || null;
      await this.tutorStudentRepo.save(tutorStudent);
    }
  }

  /**
   * Normalize student name / firstName / lastName on the entity before save+user sync.
   * When `nameIsSource` is true, Student.name wins and first/last are re-derived.
   */
  normalizeStudentNameFields(
    student: StudentEntity,
    options?: { nameIsSource?: boolean },
  ): StudentEntity {
    const parts = resolveNameParts({
      name: student.name,
      firstName: student.firstName,
      lastName: student.lastName,
      emailFallback: student.email,
      nameIsSource: options?.nameIsSource,
    });
    student.name = parts.name || student.name;
    student.firstName = parts.firstName || student.firstName;
    student.lastName = parts.lastName || student.lastName;
    return student;
  }

  normalizeTeacherNameFields(teacher: TeacherEntity): TeacherEntity {
    const parts = resolveNameParts({
      name: teacher.name,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      emailFallback: teacher.email,
    });
    teacher.name = parts.name || teacher.name;
    teacher.firstName = parts.firstName || teacher.firstName;
    teacher.lastName = parts.lastName || teacher.lastName;
    return teacher;
  }

  private async detachTeachersForUser(
    teacherRepo: Repository<TeacherEntity>,
    userId: string,
  ): Promise<void> {
    await teacherRepo.update({ userId }, { userId: null, status: 'inactive' });
  }

  private async detachTutorsForUser(
    tutorRepo: Repository<TutorEntity>,
    userId: string,
  ): Promise<void> {
    await tutorRepo.update({ userId }, { userId: null, status: 'inactive' });
  }

  private async detachTutorStudentsForUser(
    tutorStudentRepo: Repository<TutorStudentEntity>,
    userId: string,
  ): Promise<void> {
    await tutorStudentRepo.update({ userId }, { userId: null, status: 'inactive' });
  }

  private async detachStudentsForUser(
    studentRepo: Repository<StudentEntity>,
    userId: string,
  ): Promise<void> {
    // Keep assignedTeacherId (referral history). Unlink user and mark inactive so
    // live referral counts (User.role = student) exclude this person until they
    // become a student again.
    await studentRepo.update({ userId }, { userId: null, status: 'inactive' });
  }

  private async ensureTutorStudentProfile(
    tutorStudentRepo: Repository<TutorStudentEntity>,
    user: RoleEntityUserContext,
    assignedTutorId: string | null,
    manager?: EntityManager,
  ): Promise<void> {
    if (!assignedTutorId) {
      throw new BadRequestException(
        'Для роли «Ученик репетитора» нужен закреплённый репетитор',
      );
    }

    let row =
      (await tutorStudentRepo.findOne({ where: { userId: user.id } })) ??
      (user.email
        ? await tutorStudentRepo.findOne({
            where: { email: user.email, tutorId: assignedTutorId },
          })
        : null);

    if (row?.userId && row.userId !== user.id) {
      row = null;
    }

    if (row) {
      row.userId = user.id;
      row.tutorId = assignedTutorId;
      row.status = 'active';
      row.email = user.email;
      row.name = this.displayName(user);
      row.firstName = user.firstName || row.firstName;
      row.lastName = user.lastName || row.lastName;
      await tutorStudentRepo.save(row);
      return;
    }

    await tutorStudentRepo.save(
      tutorStudentRepo.create({
        id: randomUUID(),
        tutorId: assignedTutorId,
        name: this.displayName(user),
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || null,
        userId: user.id,
        status: 'active',
      }),
    );

    // Silence unused manager warning while keeping signature consistent for txn callers.
    void manager;
  }

  private async ensureStudentProfile(
    studentRepo: Repository<StudentEntity>,
    user: RoleEntityUserContext,
    options?: {
      assignedTeacherId?: string | null;
      /** True when registration/invite explicitly passed assignedTeacherId (even null). */
      applyTeacherAssignment?: boolean;
    },
  ): Promise<void> {
    let row =
      (await studentRepo.findOne({ where: { userId: user.id } })) ??
      (user.email ? await studentRepo.findOne({ where: { email: user.email } }) : null);

    if (row?.userId && row.userId !== user.id) {
      row = null;
    }

    const inviteTeacherId = options?.assignedTeacherId ?? null;
    const applyTeacher = Boolean(options?.applyTeacherAssignment);
    const wasUnlinked = Boolean(row && !row.userId);

    if (row) {
      row.userId = user.id;
      row.email = user.email;
      row.name = this.displayName(user);
      row.firstName = user.firstName || row.firstName;
      row.lastName = user.lastName || row.lastName;

      if (applyTeacher) {
        if (inviteTeacherId) {
          // Registration via teacher referral — bind to that teacher only.
          row.assignedTeacherId = inviteTeacherId;
          row.status = 'active';
        } else if (wasUnlinked) {
          // Self-registration without referral: never inherit orphan's teacher.
          row.assignedTeacherId = null;
          row.status = 'pending_assignment';
        } else if (!row.assignedTeacherId) {
          row.status =
            row.status === 'inactive' || row.status === 'paused'
              ? row.status
              : 'pending_assignment';
        }
      } else if (row.assignedTeacherId) {
        // Role restored to student (e.g. tutor → student): keep referral history,
        // re-activate so teacher referral counts include this user again.
        if (row.status === 'pending_assignment' || row.status === 'inactive' || wasUnlinked) {
          row.status = 'active';
        }
      } else if (row.status === 'active') {
        // Idempotent sync without invite context — keep teacher null, mark queue.
        row.status = 'pending_assignment';
      }

      await studentRepo.save(row);
      return;
    }

    const hasTeacher = Boolean(inviteTeacherId);
    await studentRepo.save(
      studentRepo.create({
        id: randomUUID(),
        name: this.displayName(user),
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        userId: user.id,
        status: hasTeacher ? 'active' : 'pending_assignment',
        lessonBalance: 0,
        // Never fall back to "first teacher in DB" — only explicit invite id.
        assignedTeacherId: inviteTeacherId,
      }),
    );
  }

  private async ensureTeacherProfile(
    teacherRepo: Repository<TeacherEntity>,
    user: RoleEntityUserContext,
  ): Promise<void> {
    let row =
      (await teacherRepo.findOne({ where: { userId: user.id } })) ??
      (user.email ? await teacherRepo.findOne({ where: { email: user.email } }) : null);

    if (row?.userId && row.userId !== user.id) {
      row = null;
    }

    if (row) {
      row.userId = user.id;
      row.status = 'active';
      row.email = user.email;
      row.name = this.displayName(user);
      row.firstName = user.firstName || row.firstName;
      row.lastName = user.lastName || row.lastName;
      await teacherRepo.save(row);
      return;
    }

    await teacherRepo.save(
      teacherRepo.create({
        id: randomUUID(),
        name: this.displayName(user),
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        userId: user.id,
        status: 'active',
      }),
    );
  }

  private async ensureTutorProfile(
    tutorRepo: Repository<TutorEntity>,
    user: RoleEntityUserContext,
  ): Promise<void> {
    let row =
      (await tutorRepo.findOne({ where: { userId: user.id } })) ??
      (user.email ? await tutorRepo.findOne({ where: { email: user.email } }) : null);

    if (row?.userId && row.userId !== user.id) {
      row = null;
    }

    if (row) {
      row.userId = user.id;
      row.status = 'active';
      row.email = user.email;
      row.displayName = this.displayName(user);
      await tutorRepo.save(row);
      return;
    }

    await tutorRepo.save(
      tutorRepo.create({
        id: randomUUID(),
        displayName: this.displayName(user),
        email: user.email,
        phone: user.phone || null,
        userId: user.id,
        status: 'active',
        commissionPercent: 1,
      }),
    );
  }

  private async saveStudent(
    studentRepo: Repository<StudentEntity>,
    row: StudentEntity,
    payload: Partial<StudentEntity>,
  ): Promise<StudentEntity> {
    Object.assign(row, payload);
    this.normalizeStudentNameFields(row, {
      nameIsSource: Boolean(String(row.name ?? '').trim()),
    });
    return studentRepo.save(row);
  }

  private async saveTeacher(
    teacherRepo: Repository<TeacherEntity>,
    row: TeacherEntity,
    payload: Partial<TeacherEntity>,
  ): Promise<TeacherEntity> {
    Object.assign(row, payload);
    return teacherRepo.save(row);
  }

  private async insertStudent(
    studentRepo: Repository<StudentEntity>,
    payload: Partial<StudentEntity>,
    idInput: unknown,
  ): Promise<StudentEntity> {
    const row = studentRepo.create({
      id: idInput ? String(idInput) : randomUUID(),
      ...payload,
    });
    this.normalizeStudentNameFields(row, {
      nameIsSource: Boolean(String(row.name ?? '').trim()),
    });
    return studentRepo.save(row);
  }

  private async insertTeacher(
    teacherRepo: Repository<TeacherEntity>,
    payload: Partial<TeacherEntity>,
    idInput: unknown,
  ): Promise<TeacherEntity> {
    const row = teacherRepo.create({
      id: idInput ? String(idInput) : randomUUID(),
      ...payload,
    });
    return teacherRepo.save(row);
  }

  private displayName(user: RoleEntityUserContext): string {
    return composeDisplayName(user.firstName, user.lastName, user.email);
  }

  private normalizeId(value: unknown): string | null {
    const id = String(value ?? '').trim();
    return id || null;
  }

  private normalizeEmail(value: unknown): string | null {
    const email = String(value ?? '').trim().toLowerCase();
    return email || null;
  }
}
