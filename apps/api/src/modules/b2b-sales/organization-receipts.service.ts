import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtPayload } from '../auth/auth.service';
import { GroupEntity } from '../groups/entities/group.entity';
import { B2bAccessService } from './b2b-access.service';
import { computeCommission } from './b2b-money.util';
import { receiptToRecord } from './b2b.mapper';
import { CreateOrganizationReceiptDto } from './dto/b2b.dto';
import { OrganizationReceiptEntity } from './entities/organization-receipt.entity';
import { SalesCommissionAccrualEntity } from './entities/sales-commission-accrual.entity';
import { SalesManagerProfileEntity } from './entities/sales-manager-profile.entity';
import { OrganizationsService } from './organizations.service';

@Injectable()
export class OrganizationReceiptsService {
  constructor(
    @InjectRepository(OrganizationReceiptEntity)
    private readonly receiptRepo: Repository<OrganizationReceiptEntity>,
    @InjectRepository(SalesCommissionAccrualEntity)
    private readonly accrualRepo: Repository<SalesCommissionAccrualEntity>,
    @InjectRepository(SalesManagerProfileEntity)
    private readonly profileRepo: Repository<SalesManagerProfileEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepo: Repository<GroupEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly organizations: OrganizationsService,
    private readonly access: B2bAccessService,
  ) {}

  async list(actor: JwtPayload, filters?: {
    organizationId?: string;
    groupId?: string;
    status?: string;
    from?: string;
    to?: string;
  }): Promise<Record<string, unknown>[]> {
    this.access.assertCanAccessB2b(actor);
    const managerId = this.access.scopeOrganizationManagerId(actor);

    const qb = this.receiptRepo
      .createQueryBuilder('r')
      .orderBy('r.received_at', 'DESC', 'NULLS LAST')
      .addOrderBy('r.created_at', 'DESC');

    if (managerId) {
      qb.andWhere('r.sales_manager_user_id = :managerId', { managerId });
    }
    if (filters?.organizationId) {
      qb.andWhere('r.organization_id = :organizationId', {
        organizationId: filters.organizationId,
      });
    }
    if (filters?.groupId) {
      qb.andWhere('r.group_id = :groupId', { groupId: filters.groupId });
    }
    if (filters?.status) {
      qb.andWhere('r.status = :status', { status: filters.status });
    }
    if (filters?.from) {
      qb.andWhere('COALESCE(r.received_at, r.created_at) >= :from', {
        from: filters.from,
      });
    }
    if (filters?.to) {
      qb.andWhere('COALESCE(r.received_at, r.created_at) <= :to', { to: filters.to });
    }

    const rows = await qb.getMany();
    return rows.map(receiptToRecord);
  }

  async create(
    actor: JwtPayload,
    dto: CreateOrganizationReceiptDto,
  ): Promise<Record<string, unknown>> {
    this.access.assertCanManageReceipts(actor);
    const org = await this.organizations.findEntityById(dto.organizationId);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    if (dto.groupId) {
      const group = await this.groupRepo.findOne({ where: { id: dto.groupId } });
      if (!group) {
        throw new NotFoundException('Group not found');
      }
      if (group.organizationId && group.organizationId !== dto.organizationId) {
        throw new BadRequestException('Group belongs to another organization');
      }
    }

    const status = dto.status ?? 'received';
    const receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : status === 'received' ? new Date() : null;
    const managerId = org.salesManagerUserId;

    return this.dataSource.transaction(async (manager) => {
      const receiptRepo = manager.getRepository(OrganizationReceiptEntity);
      const accrualRepo = manager.getRepository(SalesCommissionAccrualEntity);
      const profileRepo = manager.getRepository(SalesManagerProfileEntity);

      const saved = await receiptRepo.save(
        receiptRepo.create({
          organizationId: dto.organizationId,
          groupId: dto.groupId ?? null,
          amount: dto.amount,
          currency: dto.currency ?? 'BYN',
          receivedAt,
          status,
          purpose: dto.purpose?.trim() || null,
          salesManagerUserId: managerId,
          createdByUserId: actor.sub,
        }),
      );

      if (status === 'received' && managerId) {
        const profile = await profileRepo.findOne({ where: { userId: managerId } });
        const rate = profile?.commissionPercent ?? '0';
        const commissionAmount = computeCommission(saved.amount, rate);
        if (Number.parseFloat(commissionAmount) > 0) {
          await accrualRepo.save(
            accrualRepo.create({
              receiptId: saved.id,
              managerUserId: managerId,
              ratePercent: rate,
              commissionAmount,
              currency: saved.currency,
              status: 'accrued',
            }),
          );
        }
      }

      return receiptToRecord(saved);
    });
  }

  async sumReceivedForGroup(groupId: string): Promise<number> {
    const row = await this.receiptRepo
      .createQueryBuilder('r')
      .select('COALESCE(SUM(r.amount::numeric), 0)', 'total')
      .where('r.group_id = :groupId', { groupId })
      .andWhere("r.status = 'received'")
      .getRawOne<{ total: string }>();
    return Number.parseFloat(row?.total ?? '0') || 0;
  }

  async sumReceivedForOrganization(organizationId: string): Promise<number> {
    const row = await this.receiptRepo
      .createQueryBuilder('r')
      .select('COALESCE(SUM(r.amount::numeric), 0)', 'total')
      .where('r.organization_id = :organizationId', { organizationId })
      .andWhere("r.status = 'received'")
      .getRawOne<{ total: string }>();
    return Number.parseFloat(row?.total ?? '0') || 0;
  }
}
