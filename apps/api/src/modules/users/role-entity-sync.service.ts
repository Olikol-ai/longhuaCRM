import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { entityToRecord, recordToEntityPayload } from '../../common/utils/record.util';
import { StudentEntity } from '../../entities/Student.entity';
import { TeacherEntity } from '../../entities/Teacher.entity';
import { UserEntity } from '../../entities/user.entity';

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

  async syncAfterRoleChange(user: RoleEntityUserContext, newRole: string): Promise<void> {
    const role = newRole.trim().toLowerCase();

    if (role === 'student') {
      await this.detachTeachersForUser(user.id);
      await this.ensureStudentProfile(user);
      return;
    }

    if (role === 'teacher') {
      await this.detachStudentsForUser(user.id);
      await this.ensureTeacherProfile(user);
      return;
    }

    if (role === 'admin' || role === 'pending' || role === 'user' || role === '') {
      await this.detachTeachersForUser(user.id);
      await this.detachStudentsForUser(user.id);
    }
  }

  async upsertStudentFromCreate(
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const payload = recordToEntityPayload(input);
    const userId = this.normalizeId(payload.userId);
    const email = this.normalizeEmail(payload.email);

    if (userId) {
      const existing = await this.studentRepo.findOne({ where: { userId } });
      if (existing) {
        return this.saveStudent(existing, payload);
      }
    }

    if (email) {
      const byEmail = await this.studentRepo.findOne({ where: { email } });
      if (byEmail && (!byEmail.userId || byEmail.userId === userId)) {
        return this.saveStudent(byEmail, { ...payload, userId: userId ?? byEmail.userId });
      }
    }

    return this.insertStudent(payload, input.id);
  }

  async upsertTeacherFromCreate(
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const payload = recordToEntityPayload(input);
    const userId = this.normalizeId(payload.userId);
    const email = this.normalizeEmail(payload.email);

    if (userId) {
      const existing = await this.teacherRepo.findOne({ where: { userId } });
      if (existing) {
        return this.saveTeacher(existing, payload);
      }
    }

    if (email) {
      const byEmail = await this.teacherRepo.findOne({ where: { email } });
      if (byEmail && (!byEmail.userId || byEmail.userId === userId)) {
        return this.saveTeacher(byEmail, { ...payload, userId: userId ?? byEmail.userId });
      }
    }

    return this.insertTeacher(payload, input.id);
  }

  /** Detach login link — preserve profile data; hide from role-specific lists until restored. */
  private async detachTeachersForUser(userId: string): Promise<void> {
    await this.teacherRepo.update(
      { userId },
      {
        userId: null,
        status: 'inactive',
        updatedDate: new Date(),
      } as unknown as Partial<TeacherEntity>,
    );
  }

  /** Detach login link — preserve profile data; hide from role-specific lists until restored. */
  private async detachStudentsForUser(userId: string): Promise<void> {
    await this.studentRepo.update(
      { userId },
      {
        userId: null,
        status: 'inactive',
        updatedDate: new Date(),
      } as unknown as Partial<StudentEntity>,
    );
  }

  private async ensureStudentProfile(user: RoleEntityUserContext): Promise<void> {
    let row =
      (await this.studentRepo.findOne({ where: { userId: user.id } })) ??
      (user.email
        ? await this.studentRepo.findOne({ where: { email: user.email } })
        : null);

    if (row) {
      if (row.userId && row.userId !== user.id) {
        row = null;
      }
    }

    const now = new Date();
    if (row) {
      row.userId = user.id;
      row.status = 'active';
      row.email = user.email;
      row.name = this.displayName(user);
      row.firstName = user.firstName || row.firstName;
      row.lastName = user.lastName || row.lastName;
      row.updatedDate = now;
      await this.studentRepo.save(row);
      return;
    }

    await this.studentRepo.save(
      this.studentRepo.create({
        id: randomUUID(),
        name: this.displayName(user),
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        userId: user.id,
        status: 'active',
        lessonBalance: 0,
        createdDate: now,
        updatedDate: now,
      }),
    );
  }

  private async ensureTeacherProfile(user: RoleEntityUserContext): Promise<void> {
    let row =
      (await this.teacherRepo.findOne({ where: { userId: user.id } })) ??
      (user.email
        ? await this.teacherRepo.findOne({ where: { email: user.email } })
        : null);

    if (row) {
      if (row.userId && row.userId !== user.id) {
        row = null;
      }
    }

    const now = new Date();
    if (row) {
      row.userId = user.id;
      row.status = 'active';
      row.email = user.email;
      row.name = this.displayName(user);
      row.firstName = user.firstName || row.firstName;
      row.lastName = user.lastName || row.lastName;
      row.updatedDate = now;
      await this.teacherRepo.save(row);
      return;
    }

    await this.teacherRepo.save(
      this.teacherRepo.create({
        id: randomUUID(),
        name: this.displayName(user),
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        userId: user.id,
        status: 'active',
        createdDate: now,
        updatedDate: now,
      }),
    );
  }

  private async saveStudent(
    row: StudentEntity,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    Object.assign(row, payload);
    row.updatedDate = new Date();
    const saved = await this.studentRepo.save(row);
    return entityToRecord(saved as unknown as Record<string, unknown>);
  }

  private async saveTeacher(
    row: TeacherEntity,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    Object.assign(row, payload);
    row.updatedDate = new Date();
    const saved = await this.teacherRepo.save(row);
    return entityToRecord(saved as unknown as Record<string, unknown>);
  }

  private async insertStudent(
    payload: Record<string, unknown>,
    idInput: unknown,
  ): Promise<Record<string, unknown>> {
    const now = new Date();
    const row = this.studentRepo.create({
      id: idInput ? String(idInput) : randomUUID(),
      ...payload,
      createdDate: now,
      updatedDate: now,
    });
    const saved = await this.studentRepo.save(row);
    return entityToRecord(saved as unknown as Record<string, unknown>);
  }

  private async insertTeacher(
    payload: Record<string, unknown>,
    idInput: unknown,
  ): Promise<Record<string, unknown>> {
    const now = new Date();
    const row = this.teacherRepo.create({
      id: idInput ? String(idInput) : randomUUID(),
      ...payload,
      createdDate: now,
      updatedDate: now,
    });
    const saved = await this.teacherRepo.save(row);
    return entityToRecord(saved as unknown as Record<string, unknown>);
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
