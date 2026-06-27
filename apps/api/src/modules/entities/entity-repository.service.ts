import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { ENTITY_NAMES, EntityName } from '../../common/constants/entity-names';
import {
  AlfaBankOrderEntity,
  AppSettingEntity,
  CourseEntity,
  LessonBalanceEntity,
  LessonEntity,
  LessonMaterialEntity,
  LessonStudentEntity,
  MaterialAccessEntity,
  PaymentEntity,
  ScheduleSlotEntity,
  ShopSettingEntity,
  StudentEntity,
  TeacherAvailabilityEntity,
  TeacherEntity,
  TeacherPaymentEntity,
  WelcomePageSettingEntity,
} from '../../entities/crm.entities';

import { userToRecord } from '../users/user.mapper';
import { UsersRepository } from '../users/users.repository';

const ENTITY_CLASS_MAP: Record<string, any> = {
  Student: StudentEntity,
  Teacher: TeacherEntity,
  Lesson: LessonEntity,
  Payment: PaymentEntity,
  Course: CourseEntity,
  LessonMaterial: LessonMaterialEntity,
  ScheduleSlot: ScheduleSlotEntity,
  LessonStudent: LessonStudentEntity,
  LessonBalance: LessonBalanceEntity,
  TeacherPayment: TeacherPaymentEntity,
  MaterialAccess: MaterialAccessEntity,
  TeacherAvailability: TeacherAvailabilityEntity,
  AlfaBankOrder: AlfaBankOrderEntity,
  AppSettings: AppSettingEntity,
  ShopSettings: ShopSettingEntity,
  WelcomePageSettings: WelcomePageSettingEntity,
};

@Injectable()
export class EntityRepositoryService {
  private readonly repoMap = new Map<string, Repository<any>>();

  constructor(
    @InjectRepository(StudentEntity) studentRepo: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity) teacherRepo: Repository<TeacherEntity>,
    @InjectRepository(LessonEntity) lessonRepo: Repository<LessonEntity>,
    @InjectRepository(PaymentEntity) paymentRepo: Repository<PaymentEntity>,
    @InjectRepository(CourseEntity) courseRepo: Repository<CourseEntity>,
    @InjectRepository(LessonMaterialEntity) lessonMaterialRepo: Repository<LessonMaterialEntity>,
    @InjectRepository(ScheduleSlotEntity) scheduleSlotRepo: Repository<ScheduleSlotEntity>,
    @InjectRepository(LessonStudentEntity) lessonStudentRepo: Repository<LessonStudentEntity>,
    @InjectRepository(LessonBalanceEntity) lessonBalanceRepo: Repository<LessonBalanceEntity>,
    @InjectRepository(TeacherPaymentEntity) teacherPaymentRepo: Repository<TeacherPaymentEntity>,
    @InjectRepository(MaterialAccessEntity) materialAccessRepo: Repository<MaterialAccessEntity>,
    @InjectRepository(TeacherAvailabilityEntity) teacherAvailabilityRepo: Repository<TeacherAvailabilityEntity>,
    @InjectRepository(AlfaBankOrderEntity) alfaBankOrderRepo: Repository<AlfaBankOrderEntity>,
    @InjectRepository(AppSettingEntity) appSettingRepo: Repository<AppSettingEntity>,
    @InjectRepository(ShopSettingEntity) shopSettingRepo: Repository<ShopSettingEntity>,
    @InjectRepository(WelcomePageSettingEntity) welcomePageSettingRepo: Repository<WelcomePageSettingEntity>,
    private readonly usersRepository: UsersRepository,
  ) {
    this.repoMap.set('Student', studentRepo);
    this.repoMap.set('Teacher', teacherRepo);
    this.repoMap.set('Lesson', lessonRepo);
    this.repoMap.set('Payment', paymentRepo);
    this.repoMap.set('Course', courseRepo);
    this.repoMap.set('LessonMaterial', lessonMaterialRepo);
    this.repoMap.set('ScheduleSlot', scheduleSlotRepo);
    this.repoMap.set('LessonStudent', lessonStudentRepo);
    this.repoMap.set('LessonBalance', lessonBalanceRepo);
    this.repoMap.set('TeacherPayment', teacherPaymentRepo);
    this.repoMap.set('MaterialAccess', materialAccessRepo);
    this.repoMap.set('TeacherAvailability', teacherAvailabilityRepo);
    this.repoMap.set('AlfaBankOrder', alfaBankOrderRepo);
    this.repoMap.set('AppSettings', appSettingRepo);
    this.repoMap.set('ShopSettings', shopSettingRepo);
    this.repoMap.set('WelcomePageSettings', welcomePageSettingRepo);
  }

  isKnownEntity(entity: string): entity is EntityName {
    return entity === 'User' || (ENTITY_NAMES as readonly string[]).includes(entity);
  }

  async list(entity: EntityName, sortField?: string, limit?: number) {
    if (entity === 'User') {
      let users = await this.usersRepository.findAll();
      const records = users.map(userToRecord);
      return this.applySortAndLimit(records, sortField, limit);
    }

    const repo = this.getRepo(entity);
    const rows = await repo.find();

    const records = rows.map((r) => ({
      id: r.id,
      ...r.data,
      createdDate: r.createdDate,
      updatedDate: r.updatedDate,
    }));

    return this.applySortAndLimit(records, sortField, limit);
  }

  private applySortAndLimit(
    records: Record<string, any>[],
    sortField?: string,
    limit?: number,
  ) {
    let result = records;

    if (sortField) {
      result = [...result].sort((a, b) =>
        String(a?.[sortField]).localeCompare(String(b?.[sortField])),
      );
    }

    if (limit) {
      result = result.slice(0, limit);
    }

    return result;
  }

  async filter(entity: EntityName, query: Record<string, unknown>) {
    const list = await this.list(entity);
    return list.filter((record) => {
      return Object.entries(query).every(([key, value]) => record[key] == value);
    });
  }

  async getById(entity: EntityName, id: string) {
    if (entity === 'User') {
      const row = await this.usersRepository.findById(id);
      return row ? userToRecord(row) : null;
    }

    const repo = this.getRepo(entity);
    const row = await repo.findOne({ where: { id } });

    if (!row) return null;

    return {
      id: row.id,
      ...row.data,
      createdDate: row.createdDate,
      updatedDate: row.updatedDate,
    };
  }

  async create(entity: EntityName, input: Record<string, any>) {
    if (entity === 'User') {
      throw new Error('Use auth register for User creation');
    }

    const repo = this.getRepo(entity);
    const now = new Date();

    const id = input.id ? String(input.id) : randomUUID();

    const row = repo.create({
      id,
      data: input,
      createdDate: now,
      updatedDate: now,
    });

    return repo.save(row);
  }

  async update(entity: EntityName, id: string, input: Record<string, any>) {
    const repo = this.getRepo(entity);
    const row = await repo.findOne({ where: { id } });

    if (!row) throw new NotFoundException(`${entity} not found`);

    row.data = { ...row.data, ...input };
    row.updatedDate = new Date();

    return repo.save(row);
  }

  async delete(entity: EntityName, id: string) {
    const repo = this.getRepo(entity);
    return repo.delete({ id });
  }

  async bulkCreate(entity: EntityName, items: Record<string, any>[]) {
    const results: any[] = [];

    for (const item of items) {
      results.push(await this.create(entity, item));
    }

    return results;
  }

  async deleteRecordById(id: string) {
    for (const entity of ENTITY_NAMES) {
      const repo = this.getRepo(entity);
      const res = await repo.delete({ id });
      if (res.affected) return;
    }
  }

  private getRepo(entity: EntityName): Repository<any> {
    const repo = this.repoMap.get(entity);
    if (!repo) throw new Error(`Unknown entity: ${entity}`);
    return repo;
  }
}

export { ENTITY_CLASS_MAP };
