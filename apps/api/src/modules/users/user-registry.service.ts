import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { PendingRegistrationEntity } from '../auth/entities/pending-registration.entity';
import { EXPLICIT_NO_ROLE_DB_VALUE } from '../auth/onboarding';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { UserRegistryQueryDto } from './dto/user-registry-query.dto';
import { UserEntity } from './entities/user.entity';
import { pendingRegistrationToRegistryItem } from './pending-registration.registry';
import { studentProfileToRegistryItem } from './student-profile.registry';
import { userToRecord } from './user.mapper';

export interface UserRegistryResult {
  items: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
  page_count: number;
}

const LEGACY_ROLES = ['tutor', 'tutor_student'];
const ACCOUNT_ROLES = ['admin', 'teacher', 'student', 'sales_manager', 'pending', 'user'];

@Injectable()
export class UserRegistryService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(PendingRegistrationEntity)
    private readonly pendingRepo: Repository<PendingRegistrationEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
  ) {}

  async query(filters: UserRegistryQueryDto = {}): Promise<UserRegistryResult> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const roles = this.parseCsv(filters.roles);
    const accountStatuses = this.parseCsv(filters.accountStatuses);
    const includeUsers = this.shouldIncludeUsers(roles, accountStatuses);
    const includePending = this.shouldIncludePendingRegistrations(filters, roles, accountStatuses);
    const includeStudentProfiles = this.shouldIncludeStudentProfiles(filters, roles, accountStatuses);
    const sourceCount = [includeUsers, includePending, includeStudentProfiles].filter(Boolean).length;

    if (sourceCount === 1 && includeUsers) {
      return this.queryUsersPaginated(filters, page, limit);
    }
    if (sourceCount === 1 && includePending) {
      return this.queryPendingOnly(filters, page, limit);
    }
    if (sourceCount === 1 && includeStudentProfiles) {
      return this.queryStudentProfilesOnly(filters, page, limit);
    }
    return this.queryMerged(filters, page, limit, {
      includeUsers,
      includePending,
      includeStudentProfiles,
    });
  }

  async findRegistryItem(userId: string): Promise<Record<string, unknown> | null> {
    const row = await this.userRepo.findOne({ where: { id: userId } });
    if (!row || LEGACY_ROLES.includes(row.role)) {
      return null;
    }
    const [item] = await this.enrichRows([row]);
    return item ? { ...item, entry_type: 'account', has_account: true, deletable: true } : null;
  }

  async findPendingRegistryItem(id: string): Promise<Record<string, unknown> | null> {
    const row = await this.pendingRepo.findOne({ where: { id } });
    if (!row) {
      return null;
    }
    const userExists = await this.userRepo.findOne({
      where: { email: row.email },
    });
    if (userExists) {
      return null;
    }
    return pendingRegistrationToRegistryItem(row);
  }

  async findStudentRegistryItem(id: string): Promise<Record<string, unknown> | null> {
    const row = await this.studentRepo.findOne({ where: { id } });
    if (!row || row.status === 'inactive' || row.userId || row.mergedIntoStudentId) {
      return null;
    }
    const teacher = row.assignedTeacherId
      ? await this.teacherRepo.findOne({ where: { id: row.assignedTeacherId } })
      : null;
    return studentProfileToRegistryItem(row, teacher);
  }

  private async queryMerged(
    filters: UserRegistryQueryDto,
    page: number,
    limit: number,
    sources: {
      includeUsers: boolean;
      includePending: boolean;
      includeStudentProfiles: boolean;
    },
  ): Promise<UserRegistryResult> {
    const [users, pendingRows, studentRows] = await Promise.all([
      sources.includeUsers ? this.fetchMatchingUsers(filters) : Promise.resolve([]),
      sources.includePending ? this.fetchMatchingPending(filters) : Promise.resolve([]),
      sources.includeStudentProfiles
        ? this.fetchMatchingStudentProfiles(filters)
        : Promise.resolve([]),
    ]);

    const teachersById = await this.loadTeachersForStudents(studentRows);
    let items = [
      ...(await this.enrichRows(users)),
      ...pendingRows.map((row) => pendingRegistrationToRegistryItem(row)),
      ...studentRows.map((row) =>
        studentProfileToRegistryItem(row, teachersById.get(row.assignedTeacherId ?? '') ?? null),
      ),
    ];
    items = this.applyAccountStatusItemFilter(items, this.parseCsv(filters.accountStatuses));
    this.sortItems(items, filters.sort ?? 'name', filters.sortDir ?? 'asc');
    const total = items.length;
    const start = (page - 1) * limit;
    return {
      items: items.slice(start, start + limit),
      total,
      page,
      limit,
      page_count: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  private async queryUsersPaginated(
    filters: UserRegistryQueryDto,
    page: number,
    limit: number,
  ): Promise<UserRegistryResult> {
    const sort = filters.sort ?? 'name';
    const sortDir = filters.sortDir ?? 'asc';
    const qb = this.buildUserQuery(filters);
    const total = await qb.clone().getCount();
    this.applySort(qb, sort, sortDir);
    qb.skip((page - 1) * limit).take(limit);
    const rows = await qb.getMany();
    const items = await this.enrichRows(rows);
    return {
      items,
      total,
      page,
      limit,
      page_count: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  private async queryStudentProfilesOnly(
    filters: UserRegistryQueryDto,
    page: number,
    limit: number,
  ): Promise<UserRegistryResult> {
    const qb = this.buildStudentProfileQuery(filters);
    const total = await qb.clone().getCount();
    const sort = filters.sort ?? 'name';
    const sortDir = filters.sortDir ?? 'asc';
    this.applyStudentProfileSort(qb, sort, sortDir);
    qb.skip((page - 1) * limit).take(limit);
    const rows = await qb.getMany();
    const teachersById = await this.loadTeachersForStudents(rows);
    return {
      items: rows.map((row) =>
        studentProfileToRegistryItem(row, teachersById.get(row.assignedTeacherId ?? '') ?? null),
      ),
      total,
      page,
      limit,
      page_count: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  private buildStudentProfileQuery(filters: UserRegistryQueryDto) {
    const qb = this.studentRepo
      .createQueryBuilder('s')
      .where('s.user_id IS NULL')
      .andWhere("s.status != 'inactive'")
      .andWhere('s.merged_into_student_id IS NULL');
    this.applyStudentProfileSearch(qb, filters.search);
    this.applyStudentProfileTeacherFilter(qb, filters.assignedTeacherId);
    this.applyStudentProfileCreatedRange(qb, filters.createdFrom, filters.createdTo);
    return qb;
  }

  private fetchMatchingStudentProfiles(
    filters: UserRegistryQueryDto,
  ): Promise<StudentEntity[]> {
    return this.buildStudentProfileQuery(filters).getMany();
  }

  private async queryPendingOnly(
    filters: UserRegistryQueryDto,
    page: number,
    limit: number,
  ): Promise<UserRegistryResult> {
    const qb = this.buildPendingQuery(filters);
    const total = await qb.clone().getCount();
    const sort = filters.sort ?? 'name';
    const sortDir = filters.sortDir ?? 'asc';
    this.applyPendingSort(qb, sort, sortDir);
    qb.skip((page - 1) * limit).take(limit);
    const rows = await qb.getMany();
    return {
      items: rows.map((row) => pendingRegistrationToRegistryItem(row)),
      total,
      page,
      limit,
      page_count: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  private async loadTeachersForStudents(
    students: StudentEntity[],
  ): Promise<Map<string, TeacherEntity>> {
    const teacherIds = [
      ...new Set(students.map((s) => s.assignedTeacherId).filter((id): id is string => Boolean(id))),
    ];
    const map = new Map<string, TeacherEntity>();
    if (teacherIds.length === 0) {
      return map;
    }
    const teachers = await this.teacherRepo
      .createQueryBuilder('t')
      .where('t.id IN (:...teacherIds)', { teacherIds })
      .getMany();
    for (const teacher of teachers) {
      map.set(teacher.id, teacher);
    }
    return map;
  }

  private buildUserQuery(filters: UserRegistryQueryDto) {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .where('u.role NOT IN (:...legacyRoles)', { legacyRoles: LEGACY_ROLES });
    this.applySearch(qb, filters.search);
    this.applyRoleFilter(qb, this.parseCsv(filters.roles));
    this.applyStatusFilter(qb, this.parseCsv(filters.statuses));
    this.applyCreatedRange(qb, filters.createdFrom, filters.createdTo);
    this.applyAssignedTeacherFilter(qb, filters.assignedTeacherId);
    return qb;
  }

  private fetchMatchingUsers(filters: UserRegistryQueryDto): Promise<UserEntity[]> {
    return this.buildUserQuery(filters).getMany();
  }

  private buildPendingQuery(filters: UserRegistryQueryDto) {
    const qb = this.pendingRepo
      .createQueryBuilder('p')
      .where(
        `NOT EXISTS (SELECT 1 FROM users u WHERE LOWER(u.email) = LOWER(p.email))`,
      );
    this.applyPendingSearch(qb, filters.search);
    this.applyPendingStatusFilter(qb, this.parseCsv(filters.statuses));
    this.applyPendingCreatedRange(qb, filters.createdFrom, filters.createdTo);
    return qb;
  }

  private fetchMatchingPending(
    filters: UserRegistryQueryDto,
  ): Promise<PendingRegistrationEntity[]> {
    return this.buildPendingQuery(filters).getMany();
  }

  private shouldIncludePendingRegistrations(
    filters: UserRegistryQueryDto,
    roles: string[],
    accountStatuses: string[],
  ): boolean {
    if (filters.assignedTeacherId) {
      return false;
    }
    if (accountStatuses.length > 0 && !accountStatuses.includes('pending_registration')) {
      return false;
    }
    if (roles.length === 0) {
      return true;
    }
    return roles.includes('registration');
  }

  private shouldIncludeStudentProfiles(
    filters: UserRegistryQueryDto,
    roles: string[],
    accountStatuses: string[],
  ): boolean {
    if (accountStatuses.length > 0 && !accountStatuses.includes('no_account')) {
      return false;
    }
    if (roles.length > 0 && !roles.includes('student')) {
      return false;
    }
    return true;
  }

  private shouldIncludeUsers(roles: string[], accountStatuses: string[]): boolean {
    if (accountStatuses.length > 0) {
      const allowsAccounts = accountStatuses.some((value) =>
        ['active_account', 'blocked'].includes(value),
      );
      if (!allowsAccounts) {
        return false;
      }
    }
    if (roles.length === 0) {
      return true;
    }
    return roles.some((role) => ACCOUNT_ROLES.includes(role));
  }

  private applyAccountStatusItemFilter(
    items: Record<string, unknown>[],
    accountStatuses: string[],
  ): Record<string, unknown>[] {
    if (accountStatuses.length === 0) {
      return items;
    }
    return items.filter((item) => accountStatuses.includes(String(item.account_status ?? '')));
  }

  private sortItems(
    items: Record<string, unknown>[],
    sort: string,
    sortDir: 'asc' | 'desc',
  ): void {
    const dir = sortDir === 'desc' ? -1 : 1;
    items.sort((a, b) => {
      const av = this.sortValue(a, sort);
      const bv = this.sortValue(b, sort);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }

  private sortValue(item: Record<string, unknown>, sort: string): string {
    switch (sort) {
      case 'created_date':
        return String(item.created_date ?? '');
      case 'role':
        return String(item.account_role ?? item.role ?? '');
      case 'status':
        return String(item.status ?? '');
      case 'name':
      default:
        return String(item.full_name ?? item.email ?? '').toLowerCase();
    }
  }

  private async enrichRows(users: UserEntity[]): Promise<Record<string, unknown>[]> {
    if (users.length === 0) {
      return [];
    }
    const ids = users.map((u) => u.id);
    const students = await this.studentRepo
      .createQueryBuilder('s')
      .where('s.user_id IN (:...ids)', { ids })
      .andWhere("s.status != 'inactive'")
      .getMany();

    const teacherIds = [
      ...new Set(
        students
          .map((s) => s.assignedTeacherId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const teachersById = new Map<string, TeacherEntity>();
    if (teacherIds.length > 0) {
      const teachers = await this.teacherRepo
        .createQueryBuilder('t')
        .where('t.id IN (:...teacherIds)', { teacherIds })
        .getMany();
      for (const t of teachers) {
        teachersById.set(t.id, t);
      }
    }

    const studentByUserId = new Map(students.map((s) => [s.userId as string, s]));

    const teacherByUserId = new Map<string, TeacherEntity>();
    const linkedTeachers = await this.teacherRepo
      .createQueryBuilder('t')
      .where('t.user_id IN (:...ids)', { ids })
      .getMany();
    for (const teacher of linkedTeachers) {
      if (teacher.userId) {
        teacherByUserId.set(teacher.userId, teacher);
      }
    }

    return users.map((user) => {
      const base = userToRecord(user);
      const student = studentByUserId.get(user.id);
      const teacherProfile = teacherByUserId.get(user.id) ?? null;
      let assignedTeacherId: string | null = null;
      let assignedTeacherName = '';
      if (student?.assignedTeacherId) {
        assignedTeacherId = student.assignedTeacherId;
        assignedTeacherName = teachersById.get(student.assignedTeacherId)?.name ?? '';
      }
      if (student) {
        const display = String(student.name ?? '').trim();
        if (display) {
          base.full_name = display;
        }
        base.student_profile_id = student.id;
        base.student_status = student.status;
      }
      if (teacherProfile) {
        const display = String(teacherProfile.name ?? '').trim();
        if (display) {
          base.full_name = display;
        }
      }
      return {
        ...base,
        entry_type: 'account',
        has_account: true,
        deletable: true,
        mergeable: Boolean(student?.id && base.role === 'student'),
        account_status: user.status === 'blocked' ? 'blocked' : 'active_account',
        display_status: user.status === 'blocked' ? 'blocked' : 'active_account',
        assigned_teacher_id: assignedTeacherId,
        assigned_teacher_name: assignedTeacherName,
        teacher_profile_id: teacherProfile?.id ?? null,
        lesson_balance: student?.lessonBalance ?? null,
      };
    });
  }

  private parseCsv(value?: string): string[] {
    if (!value?.trim()) {
      return [];
    }
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }

  private applySearch(qb: SelectQueryBuilder<UserEntity>, search?: string): void {
    const q = search?.trim();
    if (!q) {
      return;
    }
    const pattern = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
    qb.andWhere(
      new Brackets((sub) => {
        sub
          .where('u.email ILIKE :pattern', { pattern })
          .orWhere('u.first_name ILIKE :pattern', { pattern })
          .orWhere('u.last_name ILIKE :pattern', { pattern })
          .orWhere('u.phone ILIKE :pattern', { pattern })
          .orWhere("CONCAT(u.last_name, ' ', u.first_name) ILIKE :pattern", { pattern })
          .orWhere("CONCAT(u.first_name, ' ', u.last_name) ILIKE :pattern", { pattern });
      }),
    );
  }

  private applyPendingSearch(
    qb: SelectQueryBuilder<PendingRegistrationEntity>,
    search?: string,
  ): void {
    const q = search?.trim();
    if (!q) {
      return;
    }
    const pattern = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
    qb.andWhere(
      new Brackets((sub) => {
        sub
          .where('p.email ILIKE :pattern', { pattern })
          .orWhere('p.first_name ILIKE :pattern', { pattern })
          .orWhere('p.last_name ILIKE :pattern', { pattern })
          .orWhere('p.phone ILIKE :pattern', { pattern })
          .orWhere("CONCAT(p.last_name, ' ', p.first_name) ILIKE :pattern", { pattern })
          .orWhere("CONCAT(p.first_name, ' ', p.last_name) ILIKE :pattern", { pattern });
      }),
    );
  }

  private applyRoleFilter(qb: SelectQueryBuilder<UserEntity>, roles: string[]): void {
    const userRoles = roles.filter((role) => ACCOUNT_ROLES.includes(role));
    if (userRoles.length === 0) {
      return;
    }
    const parts: string[] = [];
    const params: Record<string, unknown> = {};
    userRoles.forEach((role, index) => {
      if (role === 'pending') {
        parts.push(
          `(u.status = 'active' AND (u.role = '' OR u.role IS NULL OR u.role IN ('pending', 'pending-role')))`,
        );
      } else if (role === 'user') {
        parts.push(`(u.role = :explicitNoRole AND u.status = 'active')`);
        params.explicitNoRole = EXPLICIT_NO_ROLE_DB_VALUE;
      } else if (['admin', 'teacher', 'student', 'sales_manager'].includes(role)) {
        parts.push(`u.role = :filterRole${index}`);
        params[`filterRole${index}`] = role;
      }
    });
    if (parts.length > 0) {
      qb.andWhere(`(${parts.join(' OR ')})`, params);
    }
  }

  private applyStatusFilter(qb: SelectQueryBuilder<UserEntity>, statuses: string[]): void {
    if (statuses.length === 0) {
      return;
    }
    qb.andWhere('u.status IN (:...statuses)', { statuses });
  }

  private applyPendingStatusFilter(
    qb: SelectQueryBuilder<PendingRegistrationEntity>,
    statuses: string[],
  ): void {
    if (statuses.length === 0) {
      return;
    }
    const mapped = statuses.map((s) => (s === 'active' ? 'pending' : s));
    qb.andWhere('p.status IN (:...statuses)', { statuses: mapped });
  }

  private applyCreatedRange(
    qb: SelectQueryBuilder<UserEntity>,
    from?: string,
    to?: string,
  ): void {
    if (from) {
      qb.andWhere('u.created_date >= :createdFrom', { createdFrom: from });
    }
    if (to) {
      qb.andWhere('u.created_date <= :createdTo', { createdTo: to });
    }
  }

  private applyPendingCreatedRange(
    qb: SelectQueryBuilder<PendingRegistrationEntity>,
    from?: string,
    to?: string,
  ): void {
    if (from) {
      qb.andWhere('p.created_date >= :createdFrom', { createdFrom: from });
    }
    if (to) {
      qb.andWhere('p.created_date <= :createdTo', { createdTo: to });
    }
  }

  private applyAssignedTeacherFilter(
    qb: SelectQueryBuilder<UserEntity>,
    assignedTeacherId?: string,
  ): void {
    if (!assignedTeacherId) {
      return;
    }
    if (assignedTeacherId === 'none') {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM students s2
          WHERE s2.user_id = u.id
            AND s2.status != 'inactive'
            AND s2.assigned_teacher_id IS NULL
        )`,
      );
      return;
    }
    qb.andWhere(
      `EXISTS (
        SELECT 1 FROM students s2
        WHERE s2.user_id = u.id
          AND s2.status != 'inactive'
          AND s2.assigned_teacher_id = :assignedTeacherId
      )`,
      { assignedTeacherId },
    );
  }

  private applyStudentProfileSearch(
    qb: SelectQueryBuilder<StudentEntity>,
    search?: string,
  ): void {
    const q = search?.trim();
    if (!q) {
      return;
    }
    const pattern = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
    qb.leftJoin(TeacherEntity, 'st', 'st.id = s.assigned_teacher_id');
    qb.andWhere(
      new Brackets((sub) => {
        sub
          .where('s.name ILIKE :pattern', { pattern })
          .orWhere('s.email ILIKE :pattern', { pattern })
          .orWhere('s.phone ILIKE :pattern', { pattern })
          .orWhere('s.first_name ILIKE :pattern', { pattern })
          .orWhere('s.last_name ILIKE :pattern', { pattern })
          .orWhere('st.name ILIKE :pattern', { pattern });
      }),
    );
  }

  private applyStudentProfileTeacherFilter(
    qb: SelectQueryBuilder<StudentEntity>,
    assignedTeacherId?: string,
  ): void {
    if (!assignedTeacherId) {
      return;
    }
    if (assignedTeacherId === 'none') {
      qb.andWhere('s.assigned_teacher_id IS NULL');
      return;
    }
    qb.andWhere('s.assigned_teacher_id = :assignedTeacherId', { assignedTeacherId });
  }

  private applyStudentProfileCreatedRange(
    qb: SelectQueryBuilder<StudentEntity>,
    from?: string,
    to?: string,
  ): void {
    if (from) {
      qb.andWhere('s.created_at >= :createdFrom', { createdFrom: from });
    }
    if (to) {
      qb.andWhere('s.created_at <= :createdTo', { createdTo: to });
    }
  }

  private applyStudentProfileSort(
    qb: SelectQueryBuilder<StudentEntity>,
    sort: string,
    sortDir: 'asc' | 'desc',
  ): void {
    const dir = sortDir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    switch (sort) {
      case 'created_date':
        qb.orderBy('s.created_at', dir as 'ASC' | 'DESC');
        break;
      case 'status':
        qb.orderBy('s.status', dir as 'ASC' | 'DESC');
        break;
      case 'role':
        qb.orderBy('s.name', dir as 'ASC' | 'DESC');
        break;
      case 'name':
      default:
        qb.orderBy('s.name', dir as 'ASC' | 'DESC');
        break;
    }
  }

  private applySort(
    qb: SelectQueryBuilder<UserEntity>,
    sort: string,
    sortDir: 'asc' | 'desc',
  ): void {
    const dir = sortDir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    switch (sort) {
      case 'created_date':
        qb.orderBy('u.created_date', dir as 'ASC' | 'DESC');
        break;
      case 'role':
        qb.orderBy('u.role', dir as 'ASC' | 'DESC');
        break;
      case 'status':
        qb.orderBy('u.status', dir as 'ASC' | 'DESC');
        break;
      case 'name':
      default:
        qb.orderBy('u.last_name', dir as 'ASC' | 'DESC')
          .addOrderBy('u.first_name', dir as 'ASC' | 'DESC')
          .addOrderBy('u.email', dir as 'ASC' | 'DESC');
        break;
    }
  }

  private applyPendingSort(
    qb: SelectQueryBuilder<PendingRegistrationEntity>,
    sort: string,
    sortDir: 'asc' | 'desc',
  ): void {
    const dir = sortDir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    switch (sort) {
      case 'created_date':
        qb.orderBy('p.created_date', dir as 'ASC' | 'DESC');
        break;
      case 'status':
        qb.orderBy('p.status', dir as 'ASC' | 'DESC');
        break;
      case 'role':
        qb.orderBy('p.email', dir as 'ASC' | 'DESC');
        break;
      case 'name':
      default:
        qb.orderBy('p.last_name', dir as 'ASC' | 'DESC')
          .addOrderBy('p.first_name', dir as 'ASC' | 'DESC')
          .addOrderBy('p.email', dir as 'ASC' | 'DESC');
        break;
    }
  }
}
