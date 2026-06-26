import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { ENTITY_NAMES, EntityName } from '../../common/constants/entity-names';
import { JsonRecordEntity } from '../../entities/json-record.entity';
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
import { matchesFilter, recordFromEntity, sortRecords, splitRecordPayload } from '../../common/utils/record.util';
import { userToRecord } from '../users/user.mapper';
import { UsersRepository } from '../users/users.repository';

type JsonEntityClass = new () => JsonRecordEntity;

const ENTITY_CLASS_MAP: Record<string, JsonEntityClass> = {
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
  private readonly repoMap = new Map<string, Repository<JsonRecordEntity>>();

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
    this.repoMap.set('Student', studentRepo as Repository<JsonRecordEntity>);
    this.repoMap.set('Teacher', teacherRepo as Repository<JsonRecordEntity>);
    this.repoMap.set('Lesson', lessonRepo as Repository<JsonRecordEntity>);
    this.repoMap.set('Payment', paymentRepo as Repository<JsonRecordEntity>);
    this.repoMap.set('Course', courseRepo as Repository<JsonRecordEntity>);
    this.repoMap.set('LessonMaterial', lessonMaterialRepo as Repository<JsonRecordEntity>);
    this.repoMap.set('ScheduleSlot', scheduleSlotRepo as Repository<JsonRecordEntity>);
    this.repoMap.set('LessonStudent', lessonStudentRepo as Repository<JsonRecordEntity>);
    this.repoMap.set('LessonBalance', lessonBalanceRepo as Repository<JsonRecordEntity>);
    this.repoMap.set('TeacherPayment', teacherPaymentRepo as Repository<JsonRecordEntity>);
    this.repoMap.set('MaterialAccess', materialAccessRepo as Repository<JsonRecordEntity>);
    this.repoMap.set('TeacherAvailability', teacherAvailabilityRepo as Repository<JsonRecordEntity>);
    this.repoMap.set('AlfaBankOrder', alfaBankOrderRepo as Repository<JsonRecordEntity>);
    this.repoMap.set('AppSettings', appSettingRepo as Repository<JsonRecordEntity>);
    this.repoMap.set('ShopSettings', shopSettingRepo as Repository<JsonRecordEntity>);
    this.repoMap.set('WelcomePageSettings', welcomePageSettingRepo as Repository<JsonRecordEntity>);
  }

  isKnownEntity(entity: string): entity is EntityName {
    return entity === 'User' || (ENTITY_NAMES as readonly string[]).includes(entity);
  }

  async list(entity: EntityName, sortField?: string, limit?: number): Promise<Record<string, unknown>[]> {
    let records: Record<string, unknown>[];
    if (entity === 'User') {
      records = (await this.usersRepository.findAll()).map(userToRecord);
    } else {
      const repo = this.getRepo(entity);
      const rows = await repo.find();
      records = rows.map((row) => recordFromEntity(row.id, row.data, row.createdDate, row.updatedDate));
    }
    records = sortRecords(records, sortField);
    if (limit) records = records.slice(0, Number(limit));
    return records;
  }

  async filter(entity: EntityName, query: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    return (await this.list(entity)).filter((record) => matchesFilter(record, query));
  }

  async getById(entity: EntityName, id: string): Promise<Record<string, unknown> | null> {
    if (entity === 'User') {
      const row = await this.usersRepository.findById(id);
      return row ? userToRecord(row) : null;
    }
    const repo = this.getRepo(entity);
    const row = await repo.findOne({ where: { id } });
    return row ? recordFromEntity(row.id, row.data, row.createdDate, row.updatedDate) : null;
  }

  async create(entity: EntityName, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (entity === 'User') {
      throw new Error('Use auth register for User creation');
    }
    const repo = this.getRepo(entity);
    const now = new Date();
    const { id: inputId, payload } = splitRecordPayload(input);
    const id = inputId ?? randomUUID();
    const row = repo.create({
      id,
      data: payload,
      createdDate: now,
      updatedDate: now,
    });
    const saved = await repo.save(row);
    return recordFromEntity(saved.id, saved.data, saved.createdDate, saved.updatedDate);
  }

  async update(entity: EntityName, id: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (entity === 'User') {
      const row = await this.usersRepository.findById(id);
      if (!row) throw new NotFoundException('User not found');
      const allowed = ['role', 'first_name', 'last_name', 'phone', 'telegram_id', 'email'] as const;
      for (const key of allowed) {
        if (input[key] !== undefined) {
          if (key === 'first_name') row.firstName = String(input[key]);
          else if (key === 'last_name') row.lastName = String(input[key]);
          else if (key === 'telegram_id') row.telegramId = String(input[key]);
          else if (key === 'email') row.email = String(input[key]);
          else if (key === 'role') row.role = String(input[key]);
          else if (key === 'phone') row.phone = String(input[key]);
        }
      }
      row.updatedDate = new Date();
      const saved = await this.usersRepository.save(row);
      return userToRecord(saved);
    }

    const repo = this.getRepo(entity);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`${entity} not found`);

    const { payload } = splitRecordPayload(input);
    row.data = { ...row.data, ...payload };
    row.updatedDate = new Date();
    const saved = await repo.save(row);
    return recordFromEntity(saved.id, saved.data, saved.createdDate, saved.updatedDate);
  }

  async delete(entity: EntityName, id: string): Promise<void> {
    if (entity === 'User') {
      await this.usersRepository.delete(id);
      return;
    }
    const repo = this.getRepo(entity);
    await repo.delete({ id });
  }

  async bulkCreate(entity: EntityName, items: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
    const results: Record<string, unknown>[] = [];
    for (const item of items) {
      results.push(await this.create(entity, item));
    }
    return results;
  }

  async deleteRecordById(id: string): Promise<void> {
    for (const entity of ENTITY_NAMES) {
      const repo = this.getRepo(entity);
      const result = await repo.delete({ id });
      if (result.affected) return;
    }
  }

  private getRepo(entity: EntityName): Repository<JsonRecordEntity> {
    if (entity === 'User') {
      throw new Error('User entity uses UsersRepository');
    }
    const repo = this.repoMap.get(entity);
    if (!repo) {
      throw new Error(`Unknown entity repository: ${entity}`);
    }
    return repo;
  }
}

export { ENTITY_CLASS_MAP };
