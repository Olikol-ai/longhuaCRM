import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { JwtPayload } from '../auth/auth.service';
import { parseMoney, roundMoney } from './b2b-money.util';
import { B2bAccessService } from './b2b-access.service';
import { CreateCommissionPayoutDto, UpdateSalesManagerProfileDto } from './dto/b2b.dto';
import { SalesCommissionAccrualEntity } from './entities/sales-commission-accrual.entity';
import { SalesCommissionPayoutEntity } from './entities/sales-commission-payout.entity';
import { SalesManagerProfileEntity } from './entities/sales-manager-profile.entity';

@Injectable()
export class SalesCommissionsService {
  constructor(
    @InjectRepository(SalesCommissionAccrualEntity)
    private readonly accrualRepo: Repository<SalesCommissionAccrualEntity>,
    @InjectRepository(SalesCommissionPayoutEntity)
    private readonly payoutRepo: Repository<SalesCommissionPayoutEntity>,
    @InjectRepository(SalesManagerProfileEntity)
    private readonly profileRepo: Repository<SalesManagerProfileEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly access: B2bAccessService,
  ) {}

  async getProfile(actor: JwtPayload, userId: string): Promise<Record<string, unknown>> {
    this.access.assertCanAccessB2b(actor);
    if (this.access.isSalesManager(actor) && actor.sub !== userId) {
      throw new BadRequestException('Cannot read another manager profile');
    }
    const row = await this.profileRepo.findOne({ where: { userId } });
    if (!row) {
      return { user_id: userId, commission_percent: '0', status: 'inactive' };
    }
    return {
      user_id: row.userId,
      commission_percent: row.commissionPercent,
      status: row.status,
    };
  }

  async updateProfile(
    actor: JwtPayload,
    userId: string,
    dto: UpdateSalesManagerProfileDto,
  ): Promise<Record<string, unknown>> {
    this.access.assertAdmin(actor);
    let row = await this.profileRepo.findOne({ where: { userId } });
    if (!row) {
      row = this.profileRepo.create({
        userId,
        commissionPercent: dto.commissionPercent,
        status: 'active',
      });
    } else {
      row.commissionPercent = dto.commissionPercent;
      row.status = 'active';
    }
    const saved = await this.profileRepo.save(row);
    return {
      user_id: saved.userId,
      commission_percent: saved.commissionPercent,
      status: saved.status,
    };
  }

  async ensureProfile(userId: string, commissionPercent = '0'): Promise<void> {
    const existing = await this.profileRepo.findOne({ where: { userId } });
    if (existing) {
      return;
    }
    await this.profileRepo.save(
      this.profileRepo.create({
        userId,
        commissionPercent,
        status: 'active',
      }),
    );
  }

  async listAccruals(actor: JwtPayload, managerUserId?: string): Promise<Record<string, unknown>[]> {
    this.access.assertCanAccessB2b(actor);
    const scopedManager = this.access.isSalesManager(actor) ? actor.sub : managerUserId;
    const where = scopedManager ? { managerUserId: scopedManager } : {};
    const rows = await this.accrualRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
    return rows.map((row) => ({
      id: row.id,
      receipt_id: row.receiptId,
      manager_user_id: row.managerUserId,
      rate_percent: row.ratePercent,
      commission_amount: row.commissionAmount,
      currency: row.currency,
      status: row.status,
      payout_id: row.payoutId,
      created_at: row.createdAt.toISOString(),
    }));
  }

  async createPayout(
    actor: JwtPayload,
    dto: CreateCommissionPayoutDto,
  ): Promise<Record<string, unknown>> {
    this.access.assertCanManagePayouts(actor);
    const amount = parseMoney(dto.amount);
    if (amount <= 0) {
      throw new BadRequestException('Payout amount must be positive');
    }

    return this.dataSource.transaction(async (manager) => {
      const accrualRepo = manager.getRepository(SalesCommissionAccrualEntity);
      const payoutRepo = manager.getRepository(SalesCommissionPayoutEntity);

      let accruals: SalesCommissionAccrualEntity[];
      if (dto.accrualIds?.length) {
        accruals = await accrualRepo.find({
          where: {
            id: In(dto.accrualIds),
            managerUserId: dto.managerUserId,
            status: 'accrued',
          },
        });
      } else {
        accruals = await accrualRepo.find({
          where: { managerUserId: dto.managerUserId, status: 'accrued' },
          order: { createdAt: 'ASC' },
        });
      }

      const available = accruals.reduce(
        (sum, row) => sum + parseMoney(row.commissionAmount),
        0,
      );
      if (available < amount - 0.001) {
        throw new BadRequestException('Insufficient accrued commission balance');
      }

      const payout = await payoutRepo.save(
        payoutRepo.create({
          managerUserId: dto.managerUserId,
          amount: roundMoney(amount),
          currency: dto.currency ?? 'BYN',
          paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
          notes: dto.notes?.trim() || null,
          createdByUserId: actor.sub,
        }),
      );

      let remaining = amount;
      for (const accrual of accruals) {
        if (remaining <= 0.001) {
          break;
        }
        const piece = parseMoney(accrual.commissionAmount);
        if (piece <= remaining + 0.001) {
          accrual.status = 'paid';
          accrual.payoutId = payout.id;
          await accrualRepo.save(accrual);
          remaining -= piece;
        }
      }

      return {
        id: payout.id,
        manager_user_id: payout.managerUserId,
        amount: payout.amount,
        currency: payout.currency,
        paid_at: payout.paidAt.toISOString(),
        notes: payout.notes ?? '',
      };
    });
  }

  async managerSummary(actor: JwtPayload, managerUserId: string): Promise<Record<string, unknown>> {
    this.access.assertCanAccessB2b(actor);
    if (this.access.isSalesManager(actor) && actor.sub !== managerUserId) {
      throw new BadRequestException('Cannot read another manager summary');
    }

    const accruedRow = await this.accrualRepo
      .createQueryBuilder('a')
      .select('COALESCE(SUM(a.commission_amount::numeric), 0)', 'total')
      .where('a.manager_user_id = :managerUserId', { managerUserId })
      .getRawOne<{ total: string }>();

    const paidRow = await this.accrualRepo
      .createQueryBuilder('a')
      .select('COALESCE(SUM(a.commission_amount::numeric), 0)', 'total')
      .where('a.manager_user_id = :managerUserId', { managerUserId })
      .andWhere("a.status = 'paid'")
      .getRawOne<{ total: string }>();

    const payoutRow = await this.payoutRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount::numeric), 0)', 'total')
      .where('p.manager_user_id = :managerUserId', { managerUserId })
      .getRawOne<{ total: string }>();

    const totalCommission = parseMoney(accruedRow?.total ?? '0');
    const paidCommission = parseMoney(paidRow?.total ?? '0');
    const totalPayouts = parseMoney(payoutRow?.total ?? '0');

    return {
      manager_user_id: managerUserId,
      commission_total: roundMoney(totalCommission),
      commission_paid: roundMoney(paidCommission),
      commission_to_pay: roundMoney(Math.max(0, totalCommission - paidCommission)),
      payouts_total: roundMoney(totalPayouts),
    };
  }
}
