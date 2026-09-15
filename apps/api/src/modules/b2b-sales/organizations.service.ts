import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { GroupEntity } from '../groups/entities/group.entity';
import { JwtPayload } from '../auth/auth.service';
import { B2bAccessService } from './b2b-access.service';
import { mergeOrganizationDto, organizationToRecord } from './b2b.mapper';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/b2b.dto';
import { OrganizationDealEntity } from './entities/organization-deal.entity';
import { OrganizationReceiptEntity } from './entities/organization-receipt.entity';
import { OrganizationEntity } from './entities/organization.entity';
import { SalesCommissionAccrualEntity } from './entities/sales-commission-accrual.entity';
import { SalesDiaryEntryEntity } from './entities/sales-diary-entry.entity';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(OrganizationEntity)
    private readonly orgRepo: Repository<OrganizationEntity>,
    private readonly access: B2bAccessService,
  ) {}

  async list(actor: JwtPayload): Promise<Record<string, unknown>[]> {
    this.access.assertCanAccessB2b(actor);
    const managerId = this.access.scopeOrganizationManagerId(actor);
    const rows = await this.orgRepo.find({
      where: managerId ? { salesManagerUserId: managerId } : {},
      order: { name: 'ASC' },
    });
    return rows.map(organizationToRecord);
  }

  async findById(actor: JwtPayload, id: string): Promise<Record<string, unknown>> {
    const row = await this.orgRepo.findOne({ where: { id } });
    this.access.assertOrganizationExists(row);
    this.access.assertCanReadOrganization(actor, row.salesManagerUserId);
    return organizationToRecord(row);
  }

  async create(actor: JwtPayload, dto: CreateOrganizationDto): Promise<Record<string, unknown>> {
    this.access.assertCanManageOrganization(actor);
    const saved = await this.orgRepo.save(
      this.orgRepo.create({
        name: dto.name.trim(),
        unp: dto.unp?.trim() || null,
        salesManagerUserId: dto.salesManagerUserId?.trim() || null,
        status: dto.status ?? 'active',
        notes: dto.notes?.trim() || null,
      }),
    );
    return organizationToRecord(saved);
  }

  async update(
    actor: JwtPayload,
    id: string,
    dto: UpdateOrganizationDto,
  ): Promise<Record<string, unknown>> {
    this.access.assertCanManageOrganization(actor);
    const row = await this.orgRepo.findOne({ where: { id } });
    this.access.assertOrganizationExists(row);
    Object.assign(row, mergeOrganizationDto(dto));
    const saved = await this.orgRepo.save(row);
    return organizationToRecord(saved);
  }

  async archive(actor: JwtPayload, id: string): Promise<Record<string, unknown>> {
    return this.update(actor, id, { status: 'archived' });
  }

  /**
   * Hard-delete organization and exclusive B2B children.
   * Does NOT delete CRM users, teachers, students, groups, lessons, or payments.
   * Groups keep their rows; organization_id is cleared.
   */
  async remove(actor: JwtPayload, id: string): Promise<{ ok: true; id: string }> {
    this.access.assertCanManageOrganization(actor);
    const row = await this.orgRepo.findOne({ where: { id } });
    this.access.assertOrganizationExists(row);

    await this.orgRepo.manager.transaction(async (em) => {
      await em
        .createQueryBuilder()
        .update(GroupEntity)
        .set({ organizationId: null })
        .where('organization_id = :id', { id })
        .execute();

      const receipts = await em.find(OrganizationReceiptEntity, {
        where: { organizationId: id },
        select: ['id'],
      });
      const receiptIds = receipts.map((r) => r.id);
      if (receiptIds.length > 0) {
        await em.delete(SalesCommissionAccrualEntity, { receiptId: In(receiptIds) });
        await em.delete(OrganizationReceiptEntity, { id: In(receiptIds) });
      }

      await em.delete(OrganizationDealEntity, { organizationId: id });
      await em.delete(SalesDiaryEntryEntity, { organizationId: id });
      await em.delete(OrganizationEntity, { id });
    });

    return { ok: true, id };
  }

  findEntityById(id: string): Promise<OrganizationEntity | null> {
    return this.orgRepo.findOne({ where: { id } });
  }
}
