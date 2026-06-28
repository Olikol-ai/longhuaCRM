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
import { DataSource } from 'typeorm';
import { normalizeRole } from '../../common/constants/roles';
import { StudentEntity } from '../../entities/Student.entity';
import { EntityRepositoryService } from '../entities/entity-repository.service';
import { PaymentService } from '../payments/payment.service';
import { SettingsService } from '../settings/settings.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class AlfaBankService {
  private readonly logger = new Logger(AlfaBankService.name);

  constructor(
    private readonly entityRepository: EntityRepositoryService,
    private readonly paymentService: PaymentService,
    private readonly settingsService: SettingsService,
    private readonly telegramService: TelegramService,
    private readonly config: ConfigService,
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

    const ctx = this.entityRepository.getSystemContext();
    const { token: alfaToken, merchantId: alfaMerchantId } = await this.settingsService.getAlfaCredentials();
    if (!alfaToken || !alfaMerchantId) {
      throw new Error('Alfa Bank credentials not configured');
    }

    const shopItems = await this.entityRepository.filter(
      'ShopSettings',
      { item_id: params.itemId },
      ctx,
    );
    const shopItem = shopItems.find(
      (item) => item.is_active !== false && String(item.type) === params.type,
    );

    if (!shopItem) {
      throw new BadRequestException('Shop item not found, inactive, or type mismatch');
    }

    const amount = Number(shopItem.price ?? 0);
    const lessonsAdded = Number(shopItem.lessons ?? 0);
    const packageType =
      params.type === 'course' ? `course:${params.itemId}` : 'package';
    const orderNumber = `ALF-${Date.now()}`;

    const payment = await this.entityRepository.create(
      'Payment',
      {
        student_id: params.studentId,
        amount,
        lessons_added: lessonsAdded,
        package_type: packageType,
        payment_date: new Date().toISOString().split('T')[0],
        comment: `Pending Alfa Bank - Order ${orderNumber}`,
        order_number: orderNumber,
        status: 'pending',
        provider: 'alfa_bank',
      },
      ctx,
    );

    const apiUrl = this.config.get('alfaBank.apiUrl');
    const alfaPayload = {
      userName: alfaMerchantId,
      password: alfaToken,
      orderNumber,
      amount: Math.round(amount * 100),
      returnUrl: params.returnUrl || `${params.origin}/`,
      description: `${params.type === 'package' ? 'Пакет уроков' : 'Курс'} - ${params.itemId}`,
      clientId: params.studentId,
      expirationDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      language: 'RU',
    };

    const alfaRes = await fetch(`${apiUrl}/register.do`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(
        Object.fromEntries(
          Object.entries(alfaPayload).map(([key, value]) => [key, String(value)]),
        ),
      ).toString(),
    });

    const alfaData = await alfaRes.json();
    if (alfaData.errorCode !== undefined && alfaData.errorCode !== 0) {
      throw new Error(alfaData.errorMessage || 'Payment gateway error');
    }

    await this.entityRepository.update(
      'Payment',
      String(payment.id),
      {
        comment: `Alfa Bank - orderId: ${alfaData.orderId} - ${orderNumber}`,
        external_id: String(alfaData.orderId),
      },
      ctx,
    );

    return {
      ok: true,
      orderId: alfaData.orderId,
      redirectUrl: alfaData.formUrl,
      paymentId: payment.id,
      amount,
      lessonsAdded,
    };
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

  async handleWebhook(bodyText: string): Promise<string> {
    const params = new URLSearchParams(bodyText);
    const { token: alfaToken } = await this.settingsService.getAlfaCredentials();
    if (!alfaToken) {
      this.logger.warn('AlfaBank webhook rejected: credentials not configured');
      throw new ForbiddenException('Alfa Bank not configured');
    }

    const orderId = params.get('orderId');
    const orderNumber = params.get('orderNumber');
    const amount = parseInt(params.get('amount') || '0', 10) / 100;
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

    const result = await this.paymentService.markPaidFromWebhook({
      orderNumber,
      externalOrderId: orderId,
      comment: `Оплачено через Alfa Bank - ${orderId}`,
    });

    if (result.notFound) {
      this.logger.warn(`AlfaBank webhook: payment not found for order ${orderNumber}`);
      throw new NotFoundException('Payment not found');
    }

    if (result.alreadyPaid) {
      return '1';
    }

    const student = result.student;
    if (student?.telegramId) {
      if (this.paymentService.isPackagePayment(result.packageType)) {
        const msg = `✅ Платёж успешно обработан!\n\n💳 Сумма: ${amount.toFixed(2)} BYN\n📚 Уроков добавлено: ${result.lessonsAdded ?? 0}\n💡 Новый баланс: ${student.lessonBalance} уроков`;
        this.telegramService.sendMessage(String(student.telegramId), msg).catch(() => undefined);
      } else if (this.paymentService.isCoursePayment(result.packageType)) {
        const msg = `✅ Курс успешно активирован!\n\n📚 Тип: Групповой курс\n💳 Сумма: ${amount.toFixed(2)} BYN\n🎓 Всего занятий: 35 часов`;
        this.telegramService.sendMessage(String(student.telegramId), msg).catch(() => undefined);
      }
    }

    return '1';
  }

  async checkPaymentStatus(orderId: string) {
    const { token: alfaToken, merchantId } = await this.settingsService.getAlfaCredentials();
    if (!alfaToken || !merchantId) throw new Error('Alfa Bank credentials not configured');

    const apiUrl = this.config.get('alfaBank.apiUrl');
    const res = await fetch(`${apiUrl}/getOrderStatusExtended.do`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        userName: merchantId,
        password: alfaToken,
        orderId,
      }).toString(),
    });

    const data = await res.json();
    const status = String(data.orderStatus);
    const isPaid = status === '1' || status === '5';
    const labels: Record<string, string> = { '0': 'pending', '1': 'paid', '2': 'cancelled', '5': 'paid' };

    return {
      ok: true,
      orderId,
      status,
      statusLabel: labels[status] || status,
      isPaid,
      amount: (data.amount || 0) / 100,
    };
  }
}
