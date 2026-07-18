import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { normalizeRole } from '../../common/constants/roles';
import { AuditService } from '../audit/audit.service';
import { PaymentEntity } from '../payments/entities/payment.entity';
import { ShopItemEntity } from '../payments/entities/shop-item.entity';
import { PaymentsService } from '../payments/payments.service';
import { SettingsService } from '../settings/settings.service';
import { StudentEntity } from '../students/entities/student.entity';
import { UserEntity } from '../users/entities/user.entity';
import { TelegramService } from '../telegram/telegram.service';

const FORM_URL_PREFIX = '__form_url__:';
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

function buildIdempotencyOrderNumber(studentId: string, itemId: string, type: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(`${studentId}:${itemId}:${type}`)
    .digest('hex')
    .slice(0, 16);
  return `ALF-${hash}`;
}

function extractFormUrl(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const line = notes.split('\n').find((part) => part.startsWith(FORM_URL_PREFIX));
  return line ? line.slice(FORM_URL_PREFIX.length).trim() : null;
}

function withFormUrl(notes: string | null | undefined, formUrl: string): string {
  const cleaned = (notes ?? '')
    .split('\n')
    .filter((line) => !line.startsWith(FORM_URL_PREFIX))
    .join('\n')
    .trim();
  return cleaned ? `${cleaned}\n${FORM_URL_PREFIX}${formUrl}` : `${FORM_URL_PREFIX}${formUrl}`;
}

@Injectable()
export class AlfaBankService {
  private readonly logger = new Logger(AlfaBankService.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly settingsService: SettingsService,
    private readonly telegramService: TelegramService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async init(params: {
    type: string;
    itemId: string;
    studentId: string;
    returnUrl?: string;
    origin?: string;
    userId: string;
    userRole: string;
  }) {
    await this.assertStudentAccess(params.userId, params.userRole, params.studentId);

    const { token: alfaToken, merchantId: alfaMerchantId } =
      await this.settingsService.getAlfaCredentials();
    if (!alfaToken || !alfaMerchantId) {
      throw new Error('Alfa Bank credentials not configured');
    }

    const shopItems = await this.paymentsService.filterShopItems({
      id: params.itemId,
      is_active: true,
    });
    const shopItem = shopItems.find((item) => String(item.type) === params.type);

    if (!shopItem) {
      throw new BadRequestException('Shop item not found, inactive, or type mismatch');
    }

    const amount = Number(shopItem.price ?? 0);
    const lessonsAdded = shopItem.type === 'package' ? Number(shopItem.lessonsCount ?? 0) : 0;
    const orderNumber = buildIdempotencyOrderNumber(
      params.studentId,
      params.itemId,
      params.type,
    );

    const { payment, createdNew } = await this.acquirePendingPayment({
      studentId: params.studentId,
      shopItem,
      orderNumber,
      amount,
      lessonsAdded,
    });

    const storedFormUrl = extractFormUrl(payment.notes);
    if (storedFormUrl && payment.externalId) {
      return {
        ok: true,
        orderId: payment.externalId,
        redirectUrl: storedFormUrl,
        paymentId: payment.id,
        amount: Number(payment.amount),
        lessonsAdded: payment.lessonsAdded ?? 0,
        reused: true,
      };
    }

    const apiUrl = this.config.get('alfaBank.apiUrl');
    const returnUrl = this.buildPaymentReturnUrl(params.returnUrl, params.origin, payment.id);
    const activeOrderNumber = payment.orderNumber || orderNumber;
    const alfaPayload = {
      userName: alfaMerchantId,
      password: alfaToken,
      orderNumber: activeOrderNumber,
      amount: Math.round(amount * 100),
      returnUrl,
      description: `${params.type === 'package' ? 'Пакет уроков' : 'Курс'} - ${shopItem.name}`,
      clientId: params.studentId,
      expirationDate: new Date(Date.now() + PENDING_TTL_MS).toISOString(),
      language: 'RU',
    };

    try {
      const alfaRes = await fetch(`${apiUrl}/register.do`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(
          Object.fromEntries(
            Object.entries(alfaPayload).map(([key, value]) => [key, String(value)]),
          ),
        ).toString(),
        signal: AbortSignal.timeout(15_000),
      });

      const alfaData = await alfaRes.json();
      if (alfaData.errorCode !== undefined && alfaData.errorCode !== 0) {
        throw new Error(alfaData.errorMessage || 'Payment gateway error');
      }

      payment.externalId = String(alfaData.orderId);
      payment.notes = withFormUrl(
        `Alfa Bank - orderId: ${alfaData.orderId} - ${activeOrderNumber}`,
        String(alfaData.formUrl),
      );
      await this.dataSource.getRepository(PaymentEntity).save(payment);

      return {
        ok: true,
        orderId: alfaData.orderId,
        redirectUrl: alfaData.formUrl,
        paymentId: payment.id,
        amount,
        lessonsAdded,
      };
    } catch (error) {
      if (createdNew) {
        await this.dataSource.getRepository(PaymentEntity).delete({ id: payment.id });
      }
      throw error;
    }
  }

  async requestOfflinePayment(params: {
    userId: string;
    userRole: string;
    studentId: string;
    itemLabel: string;
    amount: number;
    method: string;
    itemId?: string;
  }) {
    await this.assertStudentAccess(params.userId, params.userRole, params.studentId);

    const student = await this.dataSource.getRepository(StudentEntity).findOne({
      where: { id: params.studentId },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const methodLabel =
      params.method === 'erip'
        ? 'ЕРИП'
        : params.method === 'cash'
          ? 'Наличные в офисе'
          : params.method;

    const message =
      `📋 Заявка на пополнение баланса\n\n` +
      `👤 ${student.name}\n` +
      `📦 ${params.itemLabel}\n` +
      `💳 ${params.amount} BYN\n` +
      `💬 Способ: ${methodLabel}` +
      (params.itemId ? `\n🆔 ${params.itemId}` : '');

    const adminUsers = await this.dataSource.getRepository(UserEntity).find({
      where: { role: 'admin', status: 'active' },
    });

    let notified = 0;
    for (const admin of adminUsers) {
      if (!admin.telegramId?.trim()) continue;
      try {
        await this.telegramService.sendMessage(admin.telegramId, message);
        notified += 1;
      } catch (error) {
        this.logger.warn(
          `Failed to notify admin ${admin.id} via Telegram: ${(error as Error).message}`,
        );
      }
    }

    await this.audit.log({
      actorUserId: params.userId,
      action: 'offline_payment_request',
      entityType: 'Student',
      entityId: params.studentId,
      summary: `${params.itemLabel} | ${params.amount} BYN | ${methodLabel} | notified=${notified}`,
    });

    return {
      ok: true,
      saved: true,
      notified,
      warning:
        notified === 0
          ? 'Заявка сохранена. Администратор пока не получил уведомление в Telegram — свяжитесь со школой напрямую.'
          : undefined,
    };
  }

  private buildPaymentReturnUrl(
    returnUrl: string | undefined,
    origin: string | undefined,
    paymentId: string,
  ): string {
    const publicUrl = (this.config.get<string>('appPublicUrl') ?? '').replace(/\/$/, '');
    const originBase = (origin ?? '').replace(/\/$/, '');
    const base =
      (returnUrl && returnUrl.trim()) ||
      (publicUrl ? `${publicUrl}/PaymentReturn` : `${originBase}/PaymentReturn`);

    try {
      const url = new URL(base);
      url.searchParams.set('payment_id', paymentId);
      return url.toString();
    } catch {
      const sep = base.includes('?') ? '&' : '?';
      return `${base}${sep}payment_id=${encodeURIComponent(paymentId)}`;
    }
  }

  private async acquirePendingPayment(input: {
    studentId: string;
    shopItem: ShopItemEntity;
    orderNumber: string;
    amount: number;
    lessonsAdded: number;
  }): Promise<{ payment: PaymentEntity; createdNew: boolean }> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PaymentEntity);
      const existing = await this.findReusablePendingPayment(
        repo,
        input.studentId,
        input.shopItem.id,
        true,
      );

      if (existing) {
        if (!existing.orderNumber) {
          existing.orderNumber = input.orderNumber;
          await repo.save(existing);
        }
        return { payment: existing, createdNew: false };
      }

      try {
        const created = await repo.save(
          repo.create({
            studentId: input.studentId,
            shopItemId: input.shopItem.id,
            amount: input.amount,
            lessonsAdded: input.lessonsAdded,
            paymentDate: new Date().toISOString().split('T')[0],
            notes: `Pending Alfa Bank - Order ${input.orderNumber}`,
            orderNumber: input.orderNumber,
            status: 'pending',
            provider: 'alfa_bank',
            currency: 'BYN',
          }),
        );
        return { payment: created, createdNew: true };
      } catch (error) {
        if (this.isUniqueViolation(error)) {
          const retry = await this.findReusablePendingPayment(
            repo,
            input.studentId,
            input.shopItem.id,
            true,
          );
          if (retry) {
            return { payment: retry, createdNew: false };
          }
        }
        throw error;
      }
    });
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code ===
        '23505'
    );
  }

  private async findReusablePendingPayment(
    paymentRepo: Repository<PaymentEntity>,
    studentId: string,
    shopItemId: string,
    forUpdate = false,
  ): Promise<PaymentEntity | null> {
    const qb = paymentRepo
      .createQueryBuilder('payment')
      .where('payment.student_id = :studentId', { studentId })
      .andWhere('payment.shop_item_id = :shopItemId', { shopItemId })
      .andWhere('payment.status = :status', { status: 'pending' })
      .andWhere('payment.provider = :provider', { provider: 'alfa_bank' })
      .orderBy('payment.created_at', 'DESC');

    if (forUpdate) {
      qb.setLock('pessimistic_write');
    }

    const existing = await qb.getOne();
    if (!existing) {
      return null;
    }

    const ageMs = Date.now() - existing.createdAt.getTime();
    if (ageMs >= PENDING_TTL_MS) {
      existing.status = 'failed';
      await paymentRepo.save(existing);
      return null;
    }

    return existing;
  }

  private async assertStudentAccess(
    userId: string,
    userRole: string,
    studentId: string,
  ): Promise<void> {
    const role = normalizeRole(userRole);
    if (role === 'admin') {
      return;
    }

    const student = await this.dataSource.getRepository(StudentEntity).findOne({
      where: { id: studentId },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    if (role === 'student') {
      if (student.userId !== userId) {
        throw new ForbiddenException('Cannot initiate payment for another student');
      }
      return;
    }

    throw new ForbiddenException('Only students and administrators can initiate payments');
  }

  /**
   * Shared success path for webhook + status poll.
   * Idempotent: already-paid payments skip side effects (enrollment / Telegram).
   */
  async confirmPaidAndNotify(params: {
    orderNumber: string;
    externalOrderId: string;
  }): Promise<{
    applied: boolean;
    alreadyPaid?: boolean;
    notFound?: boolean;
    paymentId?: string;
    status: 'paid' | 'pending' | 'failed' | 'refunded' | 'unknown';
  }> {
    const result = await this.paymentsService.markPaidFromWebhook({
      orderNumber: params.orderNumber,
      externalOrderId: params.externalOrderId,
      comment: `Оплачено через Alfa Bank - ${params.externalOrderId}`,
    });

    if (result.notFound) {
      return { applied: false, notFound: true, status: 'unknown' };
    }

    if (result.alreadyPaid) {
      return {
        applied: true,
        alreadyPaid: true,
        paymentId: result.paymentId,
        status: 'paid',
      };
    }

    await this.notifyStudentPaymentSuccess(result);
    return {
      applied: true,
      alreadyPaid: false,
      paymentId: result.paymentId,
      status: 'paid',
    };
  }

  async handleWebhook(bodyText: string): Promise<string> {
    const params = new URLSearchParams(bodyText);
    const { token: alfaToken } = await this.settingsService.getAlfaCredentials();
    if (!alfaToken) {
      this.logger.warn('AlfaBank webhook rejected: credentials not configured');
      throw new ForbiddenException('Alfa Bank not configured');
    }

    const orderId = params.get('orderId');
    const orderNumber = params.get('orderNumber');
    const status = params.get('status');
    const checksum = params.get('checksum');

    if (!orderId || !orderNumber || status !== '1') {
      return '0';
    }

    const expectedChecksum = crypto
      .createHash('md5')
      .update(`${orderId};${params.get('amount')};810;${alfaToken}`)
      .digest('hex');

    if (checksum !== expectedChecksum) {
      this.logger.warn(
        `AlfaBank webhook rejected: invalid checksum for order ${orderNumber}`,
      );
      throw new ForbiddenException('Invalid AlfaBank webhook signature');
    }

    const result = await this.confirmPaidAndNotify({
      orderNumber,
      externalOrderId: orderId,
    });

    if (result.notFound) {
      this.logger.warn(`AlfaBank webhook: payment not found for order ${orderNumber}`);
      throw new NotFoundException('Payment not found');
    }

    return '1';
  }

  /**
   * Student/admin status check after return from bank.
   * Never trusts browser return alone — polls Alfa when still pending, then uses confirmPaidAndNotify.
   */
  async getPaymentStatusForActor(
    paymentId: string,
    userId: string,
    userRole: string,
  ): Promise<{
    ok: true;
    payment_id: string;
    status: PaymentEntity['status'];
    amount: number;
    currency: string;
    order_number: string | null;
    provider: string;
    message: string;
  }> {
    const payment = await this.dataSource.getRepository(PaymentEntity).findOne({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (!payment.studentId) {
      throw new BadRequestException('Payment has no student');
    }
    await this.assertStudentAccess(userId, userRole, payment.studentId);

    if (payment.status === 'pending' && payment.externalId && payment.orderNumber) {
      await this.syncPendingPaymentFromAlfa(payment);
    }

    const fresh = await this.dataSource.getRepository(PaymentEntity).findOne({
      where: { id: paymentId },
    });
    if (!fresh) {
      throw new NotFoundException('Payment not found');
    }

    return {
      ok: true,
      payment_id: fresh.id,
      status: fresh.status,
      amount: Number(fresh.amount),
      currency: fresh.currency ?? 'BYN',
      order_number: fresh.orderNumber,
      provider: fresh.provider,
      message: this.statusUserMessage(fresh.status),
    };
  }

  /** Legacy RPC: resolve by Alfa orderId, then sync via the same confirm path. */
  async checkPaymentStatus(orderId: string) {
    const payment = await this.dataSource.getRepository(PaymentEntity).findOne({
      where: { externalId: orderId },
    });

    if (payment?.orderNumber) {
      if (payment.status === 'pending') {
        await this.syncPendingPaymentFromAlfa(payment);
      }
      const fresh = await this.dataSource.getRepository(PaymentEntity).findOne({
        where: { id: payment.id },
      });
      return {
        ok: true,
        orderId,
        paymentId: payment.id,
        status: fresh?.status ?? payment.status,
        statusLabel: fresh?.status ?? payment.status,
        isPaid: (fresh?.status ?? payment.status) === 'paid',
        amount: Number(fresh?.amount ?? payment.amount),
      };
    }

    const gateway = await this.fetchAlfaOrderStatus(orderId);
    return {
      ok: true,
      orderId,
      status: gateway.orderStatus,
      statusLabel: gateway.statusLabel,
      isPaid: gateway.isPaid,
      amount: gateway.amount,
    };
  }

  private async syncPendingPaymentFromAlfa(payment: PaymentEntity): Promise<void> {
    if (!payment.externalId || !payment.orderNumber) {
      return;
    }
    if (payment.status !== 'pending') {
      return;
    }

    let gateway: Awaited<ReturnType<AlfaBankService['fetchAlfaOrderStatus']>>;
    try {
      gateway = await this.fetchAlfaOrderStatus(payment.externalId);
    } catch (error) {
      this.logger.warn(
        `Alfa status check failed for payment ${payment.id}: ${(error as Error).message}`,
      );
      return;
    }

    if (gateway.isPaid) {
      await this.confirmPaidAndNotify({
        orderNumber: payment.orderNumber,
        externalOrderId: payment.externalId,
      });
      return;
    }

    if (gateway.isFailed) {
      payment.status = 'failed';
      await this.dataSource.getRepository(PaymentEntity).save(payment);
    }
  }

  private async fetchAlfaOrderStatus(orderId: string): Promise<{
    orderStatus: string;
    statusLabel: string;
    isPaid: boolean;
    isFailed: boolean;
    amount: number;
  }> {
    const { token: alfaToken, merchantId } = await this.settingsService.getAlfaCredentials();
    if (!alfaToken || !merchantId) {
      throw new Error('Alfa Bank credentials not configured');
    }

    const apiUrl = this.config.get('alfaBank.apiUrl');
    const res = await fetch(`${apiUrl}/getOrderStatusExtended.do`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        userName: merchantId,
        password: alfaToken,
        orderId,
      }).toString(),
      signal: AbortSignal.timeout(15_000),
    });

    const data = (await res.json()) as {
      orderStatus?: number | string;
      amount?: number;
      errorCode?: number;
      errorMessage?: string;
    };
    if (data.errorCode !== undefined && Number(data.errorCode) !== 0) {
      throw new Error(data.errorMessage || 'Payment gateway status error');
    }

    const status = String(data.orderStatus ?? '');
    const labels: Record<string, string> = {
      '0': 'pending',
      '1': 'paid',
      '2': 'cancelled',
      '3': 'pending',
      '4': 'failed',
      '5': 'paid',
      '6': 'refunded',
    };

    return {
      orderStatus: status,
      statusLabel: labels[status] || status,
      isPaid: status === '1' || status === '5',
      isFailed: status === '2' || status === '4',
      amount: (data.amount || 0) / 100,
    };
  }

  private statusUserMessage(status: PaymentEntity['status']): string {
    switch (status) {
      case 'paid':
        return 'Оплата успешно завершена';
      case 'pending':
        return 'Оплата ещё проверяется';
      case 'failed':
        return 'Оплата не прошла';
      case 'refunded':
        return 'Оплата возвращена';
      default:
        return 'Статус неизвестен';
    }
  }

  private async notifyStudentPaymentSuccess(result: {
    student?: StudentEntity;
    shopItem?: ShopItemEntity | null;
    lessonsAdded?: number;
    amount?: number;
  }): Promise<void> {
    const student = result.student;
    if (!student?.telegramId) {
      return;
    }

    const itemName = result.shopItem?.name ?? 'услугу';
    let msg: string;

    if (this.paymentsService.isCoursePayment(result.shopItem)) {
      msg =
        `🎉 Оплата успешно получена!\n\n` +
        `Вы записаны на курс:\n${itemName}\n\n` +
        `Добро пожаловать в Longhua!`;
    } else if (this.paymentsService.isPackagePayment(result.shopItem)) {
      msg =
        `🎉 Оплата успешно получена!\n\n` +
        `Абонемент: ${itemName}\n` +
        `Уроков добавлено: ${result.lessonsAdded ?? 0}\n` +
        `Новый баланс: ${student.lessonBalance ?? 0}\n\n` +
        `Добро пожаловать в Longhua!`;
    } else {
      msg =
        `🎉 Оплата успешно получена!\n\n` +
        `Сумма: ${(result.amount ?? 0).toFixed(2)} BYN\n\n` +
        `Добро пожаловать в Longhua!`;
    }

    this.telegramService.sendMessage(String(student.telegramId), msg).catch(() => undefined);
  }
}
