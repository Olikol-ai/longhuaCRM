import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { JwtPayload } from '../auth/auth.service';
import { GroupEntity } from '../groups/entities/group.entity';
import { GroupMemberEntity } from '../groups/entities/group-member.entity';
import { UserEntity } from '../users/entities/user.entity';
import { B2bAccessService } from './b2b-access.service';
import { parseMoney, roundMoney } from './b2b-money.util';
import {
  BulkCreateSalesDiaryEntriesDto,
  CreateOrganizationDealDto,
  CreateSalesDiaryContactDto,
  CreateSalesDiaryEntryDto,
  CreateSalesDiaryNoteDto,
  ReassignSalesDiaryEntryDto,
  SalesDiaryListFilterDto,
  UpdateOrganizationDealDto,
  UpdateSalesDiaryEntryDto,
} from './dto/sales-diary.dto';
import { OrganizationDealEntity } from './entities/organization-deal.entity';
import { OrganizationEntity } from './entities/organization.entity';
import { OrganizationReceiptEntity } from './entities/organization-receipt.entity';
import { SalesCommissionAccrualEntity } from './entities/sales-commission-accrual.entity';
import { SalesDiaryContactEntity } from './entities/sales-diary-contact.entity';
import { SalesDiaryEntryEntity, SalesDiaryStatus } from './entities/sales-diary-entry.entity';
import { SalesDiaryNoteEntity } from './entities/sales-diary-note.entity';
import { OrganizationReceiptsService } from './organization-receipts.service';
import {
  contactToRecord,
  dealToRecord,
  entryToRecord,
  noteToRecord,
} from './sales-diary.mapper';

const IN_WORK_STATUSES: SalesDiaryStatus[] = [
  'in_progress',
  'contacted',
  'negotiations',
  'proposal_sent',
  'thinking',
];

const REFUSED_STATUSES: SalesDiaryStatus[] = ['refused', 'unreachable'];

@Injectable()
export class SalesDiaryService {
  constructor(
    @InjectRepository(SalesDiaryEntryEntity)
    private readonly entryRepo: Repository<SalesDiaryEntryEntity>,
    @InjectRepository(SalesDiaryNoteEntity)
    private readonly noteRepo: Repository<SalesDiaryNoteEntity>,
    @InjectRepository(SalesDiaryContactEntity)
    private readonly contactRepo: Repository<SalesDiaryContactEntity>,
    @InjectRepository(OrganizationDealEntity)
    private readonly dealRepo: Repository<OrganizationDealEntity>,
    @InjectRepository(OrganizationEntity)
    private readonly orgRepo: Repository<OrganizationEntity>,
    @InjectRepository(OrganizationReceiptEntity)
    private readonly receiptRepo: Repository<OrganizationReceiptEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepo: Repository<GroupEntity>,
    @InjectRepository(GroupMemberEntity)
    private readonly memberRepo: Repository<GroupMemberEntity>,
    @InjectRepository(SalesCommissionAccrualEntity)
    private readonly accrualRepo: Repository<SalesCommissionAccrualEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly access: B2bAccessService,
    private readonly receipts: OrganizationReceiptsService,
  ) {}

  async listEntries(actor: JwtPayload, filters: SalesDiaryListFilterDto = {}) {
    this.access.assertCanAccessB2b(actor);
    const managerId = this.resolveManagerScope(actor, filters.managerUserId);

    const qb = this.entryRepo
      .createQueryBuilder('e')
      .innerJoinAndSelect('e.organization', 'org')
      .orderBy('e.updated_at', 'DESC');

    if (managerId) {
      qb.andWhere('e.sales_manager_user_id = :managerId', { managerId });
    }

    if (filters.search?.trim()) {
      qb.andWhere('(org.name ILIKE :search OR org.unp ILIKE :search)', {
        search: `%${filters.search.trim()}%`,
      });
    }

    this.applyListFilter(qb, filters.filter);

    const rows = await qb.getMany();
    return Promise.all(rows.map((row) => this.buildEntryRecord(row)));
  }

  async getEntry(actor: JwtPayload, id: string) {
    const row = await this.entryRepo.findOne({
      where: { id },
      relations: ['organization'],
    });
    this.assertEntryExists(row);
    this.assertCanReadEntry(actor, row);

    const [record, notes, contacts, deals] = await Promise.all([
      this.buildEntryRecord(row),
      this.noteRepo.find({ where: { entryId: id }, order: { createdAt: 'DESC' } }),
      this.contactRepo.find({ where: { entryId: id }, order: { contactedAt: 'DESC' } }),
      this.dealRepo.find({ where: { entryId: id }, order: { createdAt: 'DESC' } }),
    ]);

    return {
      ...record,
      notes: notes.map(noteToRecord),
      contacts: contacts.map(contactToRecord),
      deals: deals.map(dealToRecord),
    };
  }

  async createEntry(actor: JwtPayload, dto: CreateSalesDiaryEntryDto) {
    this.access.assertAdmin(actor);
    return this.addOrganizationToDiary(dto.organizationId, dto.salesManagerUserId);
  }

  async bulkCreateEntries(actor: JwtPayload, dto: BulkCreateSalesDiaryEntriesDto) {
    this.access.assertAdmin(actor);
    const created: Record<string, unknown>[] = [];
    const errors: { organizationId: string; message: string }[] = [];

    for (const organizationId of dto.organizationIds) {
      try {
        const row = await this.addOrganizationToDiary(organizationId, dto.salesManagerUserId);
        created.push(row);
      } catch (err) {
        errors.push({
          organizationId,
          message: err instanceof Error ? err.message : 'Failed',
        });
      }
    }

    return { created, errors };
  }

  async updateEntry(actor: JwtPayload, id: string, dto: UpdateSalesDiaryEntryDto) {
    const row = await this.entryRepo.findOne({ where: { id }, relations: ['organization'] });
    this.assertEntryExists(row);
    this.assertCanEditEntry(actor, row);

    if (dto.status !== undefined) {
      row.status = dto.status;
    }
    if (dto.nextContactAt !== undefined) {
      row.nextContactAt = dto.nextContactAt ? new Date(dto.nextContactAt) : null;
    }
    if (dto.potentialStudentsCount !== undefined) {
      row.potentialStudentsCount = dto.potentialStudentsCount;
    }

    const saved = await this.entryRepo.save(row);
    return this.buildEntryRecord(saved);
  }

  async reassignEntry(actor: JwtPayload, id: string, dto: ReassignSalesDiaryEntryDto) {
    this.access.assertAdmin(actor);
    const row = await this.entryRepo.findOne({ where: { id }, relations: ['organization'] });
    this.assertEntryExists(row);

    row.salesManagerUserId = dto.salesManagerUserId;
    await this.entryRepo.save(row);

    if (row.organization) {
      row.organization.salesManagerUserId = dto.salesManagerUserId;
      await this.orgRepo.save(row.organization);
    }

    return this.buildEntryRecord(row);
  }

  async removeEntry(actor: JwtPayload, id: string) {
    this.access.assertAdmin(actor);
    const row = await this.entryRepo.findOne({ where: { id } });
    this.assertEntryExists(row);
    await this.entryRepo.remove(row);
    return { ok: true };
  }

  async addNote(actor: JwtPayload, entryId: string, dto: CreateSalesDiaryNoteDto) {
    const row = await this.entryRepo.findOne({ where: { id: entryId }, relations: ['organization'] });
    this.assertEntryExists(row);
    this.assertCanEditEntry(actor, row);

    const note = await this.noteRepo.save(
      this.noteRepo.create({
        entryId,
        salesManagerUserId: actor.sub,
        note: dto.note.trim(),
      }),
    );
    return noteToRecord(note);
  }

  async listNotes(actor: JwtPayload, entryId: string) {
    const row = await this.entryRepo.findOne({ where: { id: entryId } });
    this.assertEntryExists(row);
    this.assertCanReadEntry(actor, row);

    const notes = await this.noteRepo.find({
      where: { entryId },
      order: { createdAt: 'DESC' },
    });
    return notes.map(noteToRecord);
  }

  async addContact(actor: JwtPayload, entryId: string, dto: CreateSalesDiaryContactDto) {
    const row = await this.entryRepo.findOne({ where: { id: entryId }, relations: ['organization'] });
    this.assertEntryExists(row);
    this.assertCanEditEntry(actor, row);

    const contactedAt = new Date(dto.contactedAt);
    if (Number.isNaN(contactedAt.getTime())) {
      throw new BadRequestException('Invalid contactedAt');
    }

    const nextContactAt = dto.nextContactAt ? new Date(dto.nextContactAt) : null;
    if (nextContactAt && Number.isNaN(nextContactAt.getTime())) {
      throw new BadRequestException('Invalid nextContactAt');
    }

    const contact = await this.contactRepo.save(
      this.contactRepo.create({
        entryId,
        salesManagerUserId: actor.sub,
        contactType: dto.contactType,
        contactedAt,
        result: dto.result?.trim() || null,
        nextContactAt,
        comment: dto.comment?.trim() || null,
      }),
    );

    if (nextContactAt) {
      row.nextContactAt = nextContactAt;
    }
    if (row.status === 'new') {
      row.status = 'contacted';
    }
    await this.entryRepo.save(row);

    return contactToRecord(contact);
  }

  async listContacts(actor: JwtPayload, entryId: string) {
    const row = await this.entryRepo.findOne({ where: { id: entryId } });
    this.assertEntryExists(row);
    this.assertCanReadEntry(actor, row);

    const contacts = await this.contactRepo.find({
      where: { entryId },
      order: { contactedAt: 'DESC' },
    });
    return contacts.map(contactToRecord);
  }

  async createDeal(actor: JwtPayload, entryId: string, dto: CreateOrganizationDealDto) {
    const row = await this.entryRepo.findOne({ where: { id: entryId }, relations: ['organization'] });
    this.assertEntryExists(row);
    this.assertCanEditEntry(actor, row);

    if (dto.groupId) {
      const group = await this.groupRepo.findOne({ where: { id: dto.groupId } });
      if (!group) {
        throw new NotFoundException('Group not found');
      }
      if (group.organizationId && group.organizationId !== row.organizationId) {
        throw new BadRequestException('Group belongs to another organization');
      }
      if (!group.organizationId) {
        group.organizationId = row.organizationId;
        group.contractAmount = dto.amount;
        group.contractCurrency = dto.currency ?? 'BYN';
        await this.groupRepo.save(group);
      }
    }

    const deal = await this.dealRepo.save(
      this.dealRepo.create({
        organizationId: row.organizationId,
        entryId: row.id,
        salesManagerUserId: actor.sub,
        groupId: dto.groupId ?? null,
        studentsCount: dto.studentsCount,
        pricePerStudent: dto.pricePerStudent ?? null,
        amount: dto.amount,
        currency: dto.currency ?? 'BYN',
        contractDate: dto.contractDate ?? null,
        startDate: dto.startDate ?? null,
        status: 'signed',
        comment: dto.comment?.trim() || null,
      }),
    );

    row.status = 'contract_signed';
    await this.entryRepo.save(row);

    return dealToRecord(deal);
  }

  async updateDeal(actor: JwtPayload, dealId: string, dto: UpdateOrganizationDealDto) {
    const deal = await this.dealRepo.findOne({ where: { id: dealId } });
    if (!deal) {
      throw new NotFoundException('Deal not found');
    }

    const entry = deal.entryId
      ? await this.entryRepo.findOne({ where: { id: deal.entryId } })
      : null;
    if (entry) {
      this.assertCanEditEntry(actor, entry);
    } else {
      this.access.assertAdmin(actor);
    }

    if (dto.groupId !== undefined) {
      if (dto.groupId) {
        const group = await this.groupRepo.findOne({ where: { id: dto.groupId } });
        if (!group) {
          throw new NotFoundException('Group not found');
        }
        if (group.organizationId && group.organizationId !== deal.organizationId) {
          throw new BadRequestException('Group belongs to another organization');
        }
        if (!group.organizationId) {
          group.organizationId = deal.organizationId;
          await this.groupRepo.save(group);
        }
      }
      deal.groupId = dto.groupId;
    }
    if (dto.status !== undefined) {
      deal.status = dto.status;
    }

    const saved = await this.dealRepo.save(deal);
    return dealToRecord(saved);
  }

  async getSummary(actor: JwtPayload, managerUserId?: string) {
    this.access.assertCanAccessB2b(actor);
    const managerId = this.resolveManagerScope(actor, managerUserId);

    const entryQb = this.entryRepo.createQueryBuilder('e');
    if (managerId) {
      entryQb.where('e.sales_manager_user_id = :managerId', { managerId });
    }
    const entries = await entryQb.getMany();

    const statusCounts = {
      in_work: 0,
      contacted: 0,
      negotiations: 0,
      proposal_sent: 0,
      contract_signed: 0,
    };

    for (const entry of entries) {
      if (IN_WORK_STATUSES.includes(entry.status)) {
        statusCounts.in_work += 1;
      }
      if (entry.status === 'contacted') statusCounts.contacted += 1;
      if (entry.status === 'negotiations') statusCounts.negotiations += 1;
      if (entry.status === 'proposal_sent') statusCounts.proposal_sent += 1;
      if (entry.status === 'contract_signed') statusCounts.contract_signed += 1;
    }

    const orgIds = [...new Set(entries.map((e) => e.organizationId))];
    let potentialStudents = entries.reduce((s, e) => s + (e.potentialStudentsCount ?? 0), 0);

    let actualStudents = 0;
    let receiptsTotal = 0;
    let commissionTotal = 0;

    if (orgIds.length > 0) {
      const groups = await this.groupRepo.find({
        where: { organizationId: In(orgIds) },
      });
      const groupIds = groups.map((g) => g.id);
      if (groupIds.length > 0) {
        actualStudents = await this.memberRepo
          .createQueryBuilder('m')
          .where('m.group_id IN (:...groupIds)', { groupIds })
          .getCount();
      }

      for (const orgId of orgIds) {
        receiptsTotal += await this.receipts.sumReceivedForOrganization(orgId);
      }
    }

    const dealQb = this.dealRepo
      .createQueryBuilder('d')
      .where("d.status = 'signed'");
    if (managerId) {
      dealQb.andWhere('d.sales_manager_user_id = :managerId', { managerId });
    }
    const deals = await dealQb.getMany();
    const dealStudents = deals.reduce((s, d) => s + d.studentsCount, 0);

    if (managerId) {
      const accruals = await this.accrualRepo.find({
        where: { managerUserId: managerId },
      });
      commissionTotal = accruals.reduce((s, a) => s + parseMoney(a.commissionAmount), 0);
    } else if (this.access.isAdmin(actor)) {
      const accruals = await this.accrualRepo.find();
      commissionTotal = accruals.reduce((s, a) => s + parseMoney(a.commissionAmount), 0);
    }

    return {
      organizations_in_work: statusCounts.in_work,
      contacted: statusCounts.contacted,
      negotiations: statusCounts.negotiations,
      proposal_sent: statusCounts.proposal_sent,
      contracts_signed: statusCounts.contract_signed,
      potential_students: potentialStudents,
      deal_students: dealStudents,
      actual_students: actualStudents,
      receipts_total: roundMoney(receiptsTotal),
      commission_total: roundMoney(commissionTotal),
      diary_entries_count: entries.length,
    };
  }

  private async addOrganizationToDiary(organizationId: string, salesManagerUserId: string) {
    const org = await this.orgRepo.findOne({ where: { id: organizationId } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const existing = await this.entryRepo.findOne({ where: { organizationId } });
    if (existing) {
      throw new ConflictException('Organization is already in a sales diary');
    }

    org.salesManagerUserId = salesManagerUserId;
    await this.orgRepo.save(org);

    const saved = await this.entryRepo.save(
      this.entryRepo.create({
        organizationId,
        salesManagerUserId,
        status: 'new',
        potentialStudentsCount: 0,
      }),
    );

    saved.organization = org;
    return this.buildEntryRecord(saved);
  }

  private resolveManagerScope(actor: JwtPayload, requestedManagerId?: string): string | null {
    if (this.access.isAdmin(actor)) {
      return requestedManagerId?.trim() || null;
    }
    if (this.access.isSalesManager(actor)) {
      if (requestedManagerId && requestedManagerId !== actor.sub) {
        throw new ForbiddenException('Cannot view another manager diary');
      }
      return actor.sub;
    }
    throw new ForbiddenException('B2B sales access denied');
  }

  private applyListFilter(
    qb: ReturnType<Repository<SalesDiaryEntryEntity>['createQueryBuilder']>,
    filter?: SalesDiaryListFilterDto['filter'],
  ) {
    if (!filter || filter === 'all') return;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    switch (filter) {
      case 'today':
        qb.andWhere('e.next_contact_at >= :todayStart AND e.next_contact_at < :todayEnd', {
          todayStart,
          todayEnd,
        });
        break;
      case 'overdue':
        qb.andWhere('e.next_contact_at IS NOT NULL AND e.next_contact_at < :todayStart', {
          todayStart,
        });
        break;
      case 'in_work':
        qb.andWhere('e.status IN (:...statuses)', { statuses: IN_WORK_STATUSES });
        break;
      case 'contract_signed':
        qb.andWhere("e.status = 'contract_signed'");
        break;
      case 'refused':
        qb.andWhere('e.status IN (:...statuses)', { statuses: REFUSED_STATUSES });
        break;
      default:
        break;
    }
  }

  private async buildEntryRecord(row: SalesDiaryEntryEntity): Promise<Record<string, unknown>> {
    const org =
      row.organization ??
      (await this.orgRepo.findOne({ where: { id: row.organizationId } }));

    const [lastContact, latestNote, deals, receiptsTotal, actualStudents] = await Promise.all([
      this.contactRepo
        .createQueryBuilder('c')
        .where('c.entry_id = :entryId', { entryId: row.id })
        .orderBy('c.contacted_at', 'DESC')
        .getOne(),
      this.noteRepo.findOne({
        where: { entryId: row.id },
        order: { createdAt: 'DESC' },
      }),
      this.dealRepo.find({
        where: { organizationId: row.organizationId, status: 'signed' },
      }),
      this.receipts.sumReceivedForOrganization(row.organizationId),
      this.countActualStudents(row.organizationId),
    ]);

    const dealStudentsCount = deals.reduce((s, d) => s + d.studentsCount, 0);
    const expectedContractAmount = roundMoney(
      deals.reduce((s, d) => s + parseMoney(d.amount), 0),
    );

    const managerName = await this.resolveManagerName(row.salesManagerUserId);
    const { isOverdue, isDueToday } = this.computeDueFlags(row.nextContactAt);

    return entryToRecord(row, {
      organizationName: org?.name ?? '',
      organizationUnp: org?.unp ?? '',
      salesManagerName: managerName,
      lastContactAt: lastContact ? lastContact.contactedAt.toISOString() : null,
      dealStudentsCount,
      actualStudentsCount: actualStudents,
      expectedContractAmount,
      receiptsTotal: roundMoney(receiptsTotal),
      latestNotePreview: latestNote?.note?.slice(0, 200) ?? '',
      dealsCount: deals.length,
      isOverdue,
      isDueToday,
    });
  }

  private async countActualStudents(organizationId: string): Promise<number> {
    const groups = await this.groupRepo.find({ where: { organizationId } });
    const groupIds = groups.map((g) => g.id);
    if (groupIds.length === 0) return 0;
    return this.memberRepo
      .createQueryBuilder('m')
      .where('m.group_id IN (:...groupIds)', { groupIds })
      .getCount();
  }

  private async resolveManagerName(userId: string | null): Promise<string> {
    if (!userId) return '';
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return '';
    return user.firstName && user.lastName
      ? `${user.lastName} ${user.firstName}`
      : user.email;
  }

  private computeDueFlags(nextContactAt: Date | null): { isOverdue: boolean; isDueToday: boolean } {
    if (!nextContactAt) {
      return { isOverdue: false, isDueToday: false };
    }
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const contactDay = new Date(
      nextContactAt.getFullYear(),
      nextContactAt.getMonth(),
      nextContactAt.getDate(),
    );
    const isDueToday = contactDay.getTime() === todayStart.getTime();
    const isOverdue = contactDay.getTime() < todayStart.getTime();
    return { isOverdue, isDueToday };
  }

  private assertEntryExists<T>(row: T | null): asserts row is T {
    if (!row) {
      throw new NotFoundException('Diary entry not found');
    }
  }

  private assertCanReadEntry(actor: JwtPayload, row: SalesDiaryEntryEntity): void {
    this.access.assertCanAccessB2b(actor);
    if (this.access.isAdmin(actor)) return;
    if (row.salesManagerUserId !== actor.sub) {
      throw new ForbiddenException('Diary entry access denied');
    }
  }

  private assertCanEditEntry(actor: JwtPayload, row: SalesDiaryEntryEntity): void {
    this.assertCanReadEntry(actor, row);
    if (this.access.isAdmin(actor)) return;
    if (!this.access.isSalesManager(actor)) {
      throw new ForbiddenException('Diary entry edit denied');
    }
  }
}
