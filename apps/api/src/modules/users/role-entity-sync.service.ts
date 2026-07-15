import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager, Repository } from 'typeorm';
import { filterToEntityWhere } from '../../common/utils/api-record.util';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { UserEntity } from './entities/user.entity';

export type RoleEntityUserContext = Pick<
  UserEntity,
  'id' | 'email' | 'firstName' | 'lastName'
>;

@Injectable()
export class RoleEntitySyncService {
  constructor(
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
  ) {}

  /**
   * @param manager Optional transaction manager — when set, all writes participate in that txn.
   */
  async syncAfterRoleChange(
    user: RoleEntityUserContext,
    newRole: string,
    manager?: EntityManager,
    options?: { assignedTeacherId?: string | null },
  ): Promise<void> {
    const role = newRole.trim().toLowerCase();
    const studentRepo = manager?.getRepository(StudentEntity) ?? this.studentRepo;
    const teacherRepo = manager?.getRepository(TeacherEntity) ?? this.teacherRepo;

    if (role === 'student') {
      await this.detachTeachersForUser(teacherRepo, user.id);
      await this.ensureStudentProfile(studentRepo, user, options?.assignedTeacherId);
      return;
    }

    if (role === 'teacher') {
      await this.detachStudentsForUser(studentRepo, user.id);
      await this.ensureTeacherProfile(teacherRepo, user);
      return;
    }

    if (role === 'admin' || role === 'pending' || role === 'user' || role === '') {
      await this.detachTeachersForUser(teacherRepo, user.id);
      await this.detachStudentsForUser(studentRepo, user.id);
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

  private async detachTeachersForUser(
    teacherRepo: Repository<TeacherEntity>,
    userId: string,
  ): Promise<void> {
    await teacherRepo.update({ userId }, { userId: null, status: 'inactive' });
  }

  private async detachStudentsForUser(
    studentRepo: Repository<StudentEntity>,
    userId: string,
  ): Promise<void> {
    await studentRepo.update({ userId }, { userId: null, status: 'inactive' });
  }

  private async ensureStudentProfile(
    studentRepo: Repository<StudentEntity>,
    user: RoleEntityUserContext,
    assignedTeacherId?: string | null,
  ): Promise<void> {
    let row =
      (await studentRepo.findOne({ where: { userId: user.id } })) ??
      (user.email ? await studentRepo.findOne({ where: { email: user.email } }) : null);

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
      if (assignedTeacherId && !row.assignedTeacherId) {
        row.assignedTeacherId = assignedTeacherId;
      }
      await studentRepo.save(row);
      return;
    }

    await studentRepo.save(
      studentRepo.create({
        id: randomUUID(),
        name: this.displayName(user),
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        userId: user.id,
        status: 'active',
        lessonBalance: 0,
        assignedTeacherId: assignedTeacherId ?? null,
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

  private async saveStudent(
    studentRepo: Repository<StudentEntity>,
    row: StudentEntity,
    payload: Partial<StudentEntity>,
  ): Promise<StudentEntity> {
    Object.assign(row, payload);
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
    if (user.firstName && user.lastName) {
      return `${user.lastName} ${user.firstName}`;
    }
    return user.email;
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
