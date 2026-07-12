import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, FindOptionsWhere } from 'typeorm';
import { StudentAccessService } from '../../common/access/student-access.service';
import { JwtPayload } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import { EnrollmentEntity } from '../courses/entities/enrollment.entity';
import { CourseTemplateEntity } from '../courses/entities/course-template.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { PaymentEntity } from './entities/payment.entity';
import { ShopItemEntity } from './entities/shop-item.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateShopItemDto } from './dto/create-shop-item.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { UpdateShopItemDto } from './dto/update-shop-item.dto';
import { PaymentsRepository } from './payments.repository';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly repository: PaymentsRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly studentAccess: StudentAccessService,
  ) {}

  async findAllPayments(actor: JwtPayload): Promise<PaymentEntity[]> {
    const where = await this.studentAccess.scopePaymentFilter(actor, {});
    return this.repository.filterPayments(where as FindOptionsWhere<PaymentEntity>);
  }

  async findPaymentById(actor: JwtPayload, id: string): Promise<PaymentEntity> {
    const row = await this.repository.findPaymentById(id);
    if (!row) {
      throw new NotFoundException('Payment not found');
    }
    await this.studentAccess.assertCanReadPayment(actor, row.studentId);
    return row;
  }

  async createPayment(dto: CreatePaymentDto): Promise<PaymentEntity> {
    return this.dataSource.transaction(async (manager) => {
      const student = await manager.getRepository(StudentEntity).findOne({
        where: { id: dto.studentId },
      });
      if (!student) {
        throw new NotFoundException('Student not found');
      }

      const shopItem = dto.shopItemId
        ? await manager.getRepository(ShopItemEntity).findOne({
            where: { id: dto.shopItemId },
          })
        : null;

      const lessonsAdded =
        dto.lessonsAdded ?? (shopItem?.type === 'package' ? shopItem.lessonsCount : 0);
      const status = dto.status ?? 'paid';
      const now = new Date();
      const paymentDate = dto.paymentDate ?? now.toISOString().split('T')[0];

      const paymentRepo = manager.getRepository(PaymentEntity);
      const saved = await paymentRepo.save(
        paymentRepo.create({
          ...dto,
          lessonsAdded,
          status,
          paymentDate,
          paidAt: status === 'paid' ? now : null,
        }),
      );

      if (await this.shouldApplyBalance(manager, saved)) {
        const before = student.lessonBalance ?? 0;
        await this.applyBalanceDelta(manager, dto.studentId, lessonsAdded);
        await this.audit.log({
          action: 'lesson_balance_change',
          entityType: 'Student',
          entityId: dto.studentId,
          summary: `manual payment ${saved.id}: balance ${before} → ${before + lessonsAdded}`,
        });
      }

      return saved;
    });
  }

  async updatePayment(id: string, dto: UpdatePaymentDto): Promise<PaymentEntity> {
    return this.dataSource.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(PaymentEntity);
      const row = await paymentRepo.findOne({ where: { id } });
      if (!row) {
        throw new NotFoundException('Payment not found');
      }

      const previousLessons = row.lessonsAdded ?? 0;
      const wasBalanceApplied = await this.shouldApplyBalance(manager, row);

      if (
        dto.studentId &&
        dto.studentId !== row.studentId &&
        wasBalanceApplied
      ) {
        throw new BadRequestException(
          'Cannot reassign student on a payment that already credited lesson balance',
        );
      }

      if (
        dto.shopItemId &&
        dto.shopItemId !== row.shopItemId &&
        wasBalanceApplied
      ) {
        throw new BadRequestException(
          'Cannot change shop item on a payment that already credited lesson balance',
        );
      }

      Object.assign(row, dto);
      if (dto.status === 'paid' && !row.paidAt) {
        row.paidAt = new Date();
      }
      const saved = await paymentRepo.save(row);
      const nowApplies = await this.shouldApplyBalance(manager, saved);

      if (wasBalanceApplied || nowApplies) {
        const previousEffect = wasBalanceApplied ? previousLessons : 0;
        const nextEffect = nowApplies ? (saved.lessonsAdded ?? 0) : 0;
        const delta = nextEffect - previousEffect;
        if (delta !== 0) {
          await this.applyBalanceDelta(manager, saved.studentId, delta);
        }
      }

      return saved;
    });
  }

  async deletePayment(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(PaymentEntity);
      const row = await paymentRepo.findOne({ where: { id } });
      if (!row) {
        throw new NotFoundException('Payment not found');
      }

      if (await this.shouldApplyBalance(manager, row)) {
        await this.applyBalanceDelta(manager, row.studentId, -(row.lessonsAdded ?? 0));
      }

      await paymentRepo.delete({ id });
    });
  }

  async filterPayments(
    actor: JwtPayload,
    where: Record<string, unknown>,
  ): Promise<PaymentEntity[]> {
    const scoped = await this.studentAccess.scopePaymentFilter(actor, where);
    return this.repository.filterPayments(scoped as FindOptionsWhere<PaymentEntity>);
  }

  findAllShopItems(): Promise<ShopItemEntity[]> {
    return this.repository.findAllShopItems();
  }

  async findShopItemById(id: string): Promise<ShopItemEntity> {
    const row = await this.repository.findShopItemById(id);
    if (!row) {
      throw new NotFoundException('Shop item not found');
    }
    return row;
  }

  createShopItem(dto: CreateShopItemDto): Promise<ShopItemEntity> {
    return this.repository.saveShopItem(dto);
  }

  async updateShopItem(id: string, dto: UpdateShopItemDto): Promise<ShopItemEntity> {
    const row = await this.repository.updateShopItem(id, dto);
    if (!row) {
      throw new NotFoundException('Shop item not found');
    }
    return row;
  }

  async deleteShopItem(id: string): Promise<void> {
    await this.findShopItemById(id);
    await this.repository.deleteShopItem(id);
  }

  filterShopItems(where: Record<string, unknown>): Promise<ShopItemEntity[]> {
    return this.repository.filterShopItems(where as FindOptionsWhere<ShopItemEntity>);
  }

  isCoursePayment(shopItem: ShopItemEntity | null | undefined): boolean {
    return shopItem?.type === 'course';
  }

  isPackagePayment(shopItem: ShopItemEntity | null | undefined): boolean {
    return shopItem?.type === 'package';
  }

  async markPaidFromWebhook(params: {
    orderNumber: string;
    externalOrderId: string;
    comment: string;
  }): Promise<{
    applied: boolean;
    alreadyPaid?: boolean;
    notFound?: boolean;
    paymentId?: string;
    student?: StudentEntity;
    lessonsAdded?: number;
    shopItem?: ShopItemEntity | null;
    amount?: number;
  }> {
    return this.dataSource.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(PaymentEntity);
      const studentRepo = manager.getRepository(StudentEntity);
      const shopItemRepo = manager.getRepository(ShopItemEntity);
      const enrollmentRepo = manager.getRepository(EnrollmentEntity);

      const row = await paymentRepo
        .createQueryBuilder('payment')
        .setLock('pessimistic_write')
        .where('payment.order_number = :orderNumber', { orderNumber: params.orderNumber })
        .getOne();

      if (!row) {
        return { applied: false, notFound: true };
      }

      const shopItem = row.shopItemId
        ? await shopItemRepo.findOne({ where: { id: row.shopItemId } })
        : null;

      if (row.status === 'paid') {
        const student = await studentRepo.findOne({ where: { id: row.studentId } });
        return {
          applied: true,
          alreadyPaid: true,
          paymentId: row.id,
          student: student ?? undefined,
          lessonsAdded: row.lessonsAdded ?? 0,
          shopItem,
          amount: Number(row.amount),
        };
      }

      row.status = 'paid';
      row.paidAt = new Date();
      row.externalId = params.externalOrderId;
      row.notes = params.comment;
      await paymentRepo.save(row);

      await this.audit.log({
        action: 'payment_webhook',
        entityType: 'Payment',
        entityId: row.id,
        summary: `order ${params.orderNumber} paid via webhook`,
      });

      const student = await studentRepo.findOne({ where: { id: row.studentId } });
      if (!student) {
        return { applied: true, paymentId: row.id, shopItem };
      }

      if (this.isPackagePayment(shopItem)) {
        const lessonsAdded = row.lessonsAdded ?? 0;
        const before = student.lessonBalance ?? 0;
        const refreshed = await this.applyBalanceDelta(manager, row.studentId, lessonsAdded);
        await this.audit.log({
          action: 'lesson_balance_change',
          entityType: 'Student',
          entityId: row.studentId,
          summary: `webhook ${row.id}: balance ${before} → ${refreshed.lessonBalance ?? 0}`,
        });
        return {
          applied: true,
          paymentId: row.id,
          student: refreshed,
          lessonsAdded,
          shopItem,
          amount: Number(row.amount),
        };
      }

      if (this.isCoursePayment(shopItem)) {
        const marker = `payment:${row.id}`;
        const existing = await enrollmentRepo.findOne({
          where: { studentId: row.studentId, notes: marker },
        });

        if (!existing) {
          const template = shopItem?.courseTemplateId
            ? await manager.getRepository(CourseTemplateEntity).findOne({
                where: { id: shopItem.courseTemplateId },
              })
            : null;

          await enrollmentRepo.save(
            enrollmentRepo.create({
              id: randomUUID(),
              studentId: row.studentId,
              courseTemplateId: shopItem?.courseTemplateId ?? null,
              courseName: template?.name ?? shopItem?.name ?? 'Курс',
              totalLessons: template?.totalLessons ?? 35,
              completedLessons: 0,
              status: 'active',
              startDate: new Date().toISOString().split('T')[0],
              notes: marker,
            }),
          );
        }

        return {
          applied: true,
          paymentId: row.id,
          student,
          shopItem,
          amount: Number(row.amount),
        };
      }

      const fallbackLessons = row.lessonsAdded ?? 0;
      if (fallbackLessons > 0) {
        const before = student.lessonBalance ?? 0;
        const refreshed = await this.applyBalanceDelta(manager, row.studentId, fallbackLessons);
        await this.audit.log({
          action: 'lesson_balance_change',
          entityType: 'Student',
          entityId: row.studentId,
          summary: `webhook ${row.id}: balance ${before} → ${refreshed.lessonBalance ?? 0}`,
        });
        return {
          applied: true,
          paymentId: row.id,
          student: refreshed,
          lessonsAdded: fallbackLessons,
          shopItem,
          amount: Number(row.amount),
        };
      }

      return { applied: true, paymentId: row.id, shopItem, student };
    });
  }

  private async shouldApplyBalance(
    manager: EntityManager,
    payment: PaymentEntity,
  ): Promise<boolean> {
    if (payment.status !== 'paid') {
      return false;
    }
    if (!payment.shopItemId) {
      return (payment.lessonsAdded ?? 0) > 0;
    }
    const shopItem = await manager.getRepository(ShopItemEntity).findOne({
      where: { id: payment.shopItemId },
    });
    return shopItem?.type === 'package';
  }

  private async applyBalanceDelta(
    manager: EntityManager,
    studentId: string,
    delta: number,
  ): Promise<StudentEntity> {
    const studentRepo = manager.getRepository(StudentEntity);
    const student = await studentRepo
      .createQueryBuilder('student')
      .setLock('pessimistic_write')
      .where('student.id = :id', { id: studentId })
      .getOne();

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const nextBalance = (student.lessonBalance ?? 0) + delta;
    if (nextBalance < 0) {
      throw new BadRequestException(
        'Insufficient lesson balance for this payment adjustment',
      );
    }

    student.lessonBalance = nextBalance;
    return studentRepo.save(student);
  }
}
