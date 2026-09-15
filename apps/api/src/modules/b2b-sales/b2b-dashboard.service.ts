import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayload } from '../auth/auth.service';
import { GroupEntity } from '../groups/entities/group.entity';
import { GroupMemberEntity } from '../groups/entities/group-member.entity';
import { UserEntity } from '../users/entities/user.entity';
import { B2bAccessService } from './b2b-access.service';
import { parseMoney, roundMoney } from './b2b-money.util';
import { B2bDashboardFilterDto } from './dto/b2b.dto';
import { OrganizationEntity } from './entities/organization.entity';
import { OrganizationReceiptEntity } from './entities/organization-receipt.entity';
import { SalesCommissionAccrualEntity } from './entities/sales-commission-accrual.entity';
import { OrganizationReceiptsService } from './organization-receipts.service';
import { SalesCommissionsService } from './sales-commissions.service';

@Injectable()
export class B2bDashboardService {
  constructor(
    @InjectRepository(OrganizationEntity)
    private readonly orgRepo: Repository<OrganizationEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepo: Repository<GroupEntity>,
    @InjectRepository(GroupMemberEntity)
    private readonly memberRepo: Repository<GroupMemberEntity>,
    @InjectRepository(OrganizationReceiptEntity)
    private readonly receiptRepo: Repository<OrganizationReceiptEntity>,
    @InjectRepository(SalesCommissionAccrualEntity)
    private readonly accrualRepo: Repository<SalesCommissionAccrualEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly access: B2bAccessService,
    private readonly receipts: OrganizationReceiptsService,
    private readonly commissions: SalesCommissionsService,
  ) {}

  async getDashboard(actor: JwtPayload, filters: B2bDashboardFilterDto = {}) {
    this.access.assertCanAccessB2b(actor);
    const managerId = this.access.scopeOrganizationManagerId(actor);

    const orgWhere = managerId ? { salesManagerUserId: managerId } : {};
    const organizations = await this.orgRepo.find({
      where: orgWhere,
      order: { name: 'ASC' },
    });

    const orgIds = organizations.map((o) => o.id);
    if (orgIds.length === 0) {
      return {
        summary: {
          organizations_count: 0,
          groups_count: 0,
          students_count: 0,
          receipts_total: '0.00',
          commission_total: '0.00',
          commission_paid: '0.00',
          commission_to_pay: '0.00',
        },
        organizations: [],
      };
    }

    const groups = await this.groupRepo
      .createQueryBuilder('g')
      .where('g.organization_id IN (:...orgIds)', { orgIds })
      .getMany();

    const groupIds = groups.map((g) => g.id);
    let studentsCount = 0;
    if (groupIds.length > 0) {
      studentsCount = await this.memberRepo
        .createQueryBuilder('m')
        .where('m.group_id IN (:...groupIds)', { groupIds })
        .getCount();
    }

    const receiptQb = this.receiptRepo
      .createQueryBuilder('r')
      .select('COALESCE(SUM(r.amount::numeric), 0)', 'total')
      .where('r.organization_id IN (:...orgIds)', { orgIds })
      .andWhere("r.status = 'received'");
    if (filters.from) {
      receiptQb.andWhere('COALESCE(r.received_at, r.created_at) >= :from', { from: filters.from });
    }
    if (filters.to) {
      receiptQb.andWhere('COALESCE(r.received_at, r.created_at) <= :to', { to: filters.to });
    }
    const receiptsTotal = parseMoney((await receiptQb.getRawOne<{ total: string }>())?.total ?? '0');

    let commissionTotal = 0;
    let commissionPaid = 0;
    if (managerId || this.access.isAdmin(actor)) {
      const targetManager = managerId ?? undefined;
      const accrualQb = this.accrualRepo.createQueryBuilder('a');
      if (targetManager) {
        accrualQb.where('a.manager_user_id = :managerUserId', { managerUserId: targetManager });
      }
      const allAccruals = await accrualQb.getMany();
      commissionTotal = allAccruals.reduce((s, a) => s + parseMoney(a.commissionAmount), 0);
      commissionPaid = allAccruals
        .filter((a) => a.status === 'paid')
        .reduce((s, a) => s + parseMoney(a.commissionAmount), 0);
    }

    const orgRows = await Promise.all(
      organizations.map(async (org) => {
        const orgGroups = groups.filter((g) => g.organizationId === org.id);
        const orgGroupIds = orgGroups.map((g) => g.id);
        let orgStudents = 0;
        if (orgGroupIds.length > 0) {
          orgStudents = await this.memberRepo
            .createQueryBuilder('m')
            .where('m.group_id IN (:...orgGroupIds)', { orgGroupIds })
            .getCount();
        }
        const received = await this.receipts.sumReceivedForOrganization(org.id);
        const accruals = await this.accrualRepo.find({
          where: org.salesManagerUserId
            ? {
                managerUserId: org.salesManagerUserId,
              }
            : {},
        });
        const receiptIds = await this.receiptRepo.find({
          where: { organizationId: org.id, status: 'received' },
          select: ['id'],
        });
        const receiptIdSet = new Set(receiptIds.map((r) => r.id));
        const orgCommission = accruals
          .filter((a) => receiptIdSet.has(a.receiptId))
          .reduce((s, a) => s + parseMoney(a.commissionAmount), 0);

        let managerName = '';
        if (org.salesManagerUserId) {
          const user = await this.userRepo.findOne({ where: { id: org.salesManagerUserId } });
          if (user) {
            managerName =
              user.firstName && user.lastName
                ? `${user.lastName} ${user.firstName}`
                : user.email;
          }
        }

        return {
          id: org.id,
          name: org.name,
          unp: org.unp ?? '',
          groups_count: orgGroups.length,
          students_count: orgStudents,
          receipts_total: roundMoney(received),
          commission_total: roundMoney(orgCommission),
          sales_manager_user_id: org.salesManagerUserId,
          sales_manager_name: managerName,
        };
      }),
    );

    return {
      summary: {
        organizations_count: organizations.length,
        groups_count: groups.length,
        students_count: studentsCount,
        receipts_total: roundMoney(receiptsTotal),
        commission_total: roundMoney(commissionTotal),
        commission_paid: roundMoney(commissionPaid),
        commission_to_pay: roundMoney(Math.max(0, commissionTotal - commissionPaid)),
      },
      organizations: orgRows,
    };
  }

  async getGroupCounterpartySummary(groupId: string) {
    const group = await this.groupRepo.findOne({
      where: { id: groupId },
      relations: ['organization'],
    });
    if (!group?.organizationId) {
      return null;
    }

    const org = group.organization ?? (await this.orgRepo.findOne({ where: { id: group.organizationId } }));
    if (!org) {
      return null;
    }

    const studentsCount = await this.memberRepo.count({ where: { groupId } });
    const paidAmount = await this.receipts.sumReceivedForGroup(groupId);
    const contractAmount = parseMoney(group.contractAmount ?? '0');
    const debt = Math.max(0, contractAmount - paidAmount);

    let managerName = '';
    if (org.salesManagerUserId) {
      const user = await this.userRepo.findOne({ where: { id: org.salesManagerUserId } });
      if (user) {
        managerName =
          user.firstName && user.lastName
            ? `${user.lastName} ${user.firstName}`
            : user.email;
      }
    }

    return {
      organization_id: org.id,
      organization_name: org.name,
      unp: org.unp ?? '',
      sales_manager_user_id: org.salesManagerUserId,
      sales_manager_name: managerName,
      students_count: studentsCount,
      contract_amount: group.contractAmount ?? null,
      contract_currency: group.contractCurrency ?? 'BYN',
      paid_amount: roundMoney(paidAmount),
      debt_amount: roundMoney(debt),
    };
  }
}
