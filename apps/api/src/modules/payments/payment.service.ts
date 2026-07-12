import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { PaymentEntity } from '../../entities/payment.entity';
import { StudentEntity } from '../../entities/student.entity';
import { CourseEntity } from '../../entities/course.entity';
import { AuditService } from '../audit/audit.service';
import { paymentToRecord, recordToPaymentPayload } from './payment.mapper';

const SHOP_ITEM_TO_COURSE_TYPE: Record<string, CourseEntity['courseType']> = {
  course_basic: 'basic_beginner',
  course_adv_beginner: 'advanced_beginner',
  course_advanced: 'advanced',
};

@Injectable()
export class PaymentService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  isCoursePayment(packageType: string | null | undefined): boolean {
    if (!packageType) return false;
    return packageType === 'course' || packageType.startsWith('course:');
  }

  isPackagePayment(packageType: string | null | undefined): boolean {
    return packageType === 'package';
  }

  resolveCourseType(packageType: string | null | undefined): CourseEntity['courseType'] {
    const shopItemId = this.extractShopItemId(packageType);
    if (shopItemId && SHOP_ITEM_TO_COURSE_TYPE[shopItemId]) {
      return SHOP_ITEM_TO_COURSE_TYPE[shopItemId];
    }
    return 'advanced';
  }

  private extractShopItemId(packageType: string | null | undefined): string | null {
    if (!packageType?.startsWith('course:')) {
      return null;
    }
    return packageType.slice('course:'.length) || null;
  }

  private paymentCourseMarker(paymentId: string): string {
    return `payment:${paymentId}`;
  }

  async create(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const studentId = String(input.student_id ?? '');
    if (!studentId) {
      throw new BadRequestException('student_id is required');
    }

    const lessonsAdded = Number(input.lessons_added ?? 0);
    const status = (input.status as PaymentEntity['status']) ?? 'paid';
    const provider = (input.provider as PaymentEntity['provider']) ?? 'manual';
    const packageType = input.package_type ? String(input.package_type) : null;

    return this.dataSource.transaction(async (manager) => {
      const studentRepo = manager.getRepository(StudentEntity);
      const paymentRepo = manager.getRepository(PaymentEntity);

      const student = await studentRepo.findOne({ where: { id: studentId } });
      if (!student) {
        throw new NotFoundException('Student not found');
      }

      const now = new Date();
      const paymentDate =
        input.payment_date != null
          ? String(input.payment_date)
          : now.toISOString().split('T')[0];

      const payload = recordToPaymentPayload({
        ...input,
        status: input.status ?? status,
        provider: input.provider ?? provider,
        package_type: input.package_type ?? packageType,
      });

      const row = paymentRepo.create({
        id: input.id ? String(input.id) : randomUUID(),
        ...payload,
        studentId,
        studentName: String(input.student_name ?? student.name ?? ''),
        lessonsAdded,
        paymentDate,
        paidAt: (input.status ?? status) === 'paid' ? now : undefined,
        createdDate: now,
        updatedDate: now,
      });

      const saved = await paymentRepo.save(row);

      if (this.shouldApplyBalance(saved)) {
        const before = student.lessonBalance ?? 0;
        await this.applyBalanceDelta(manager, studentId, lessonsAdded);
        await this.audit.log({
          action: 'lesson_balance_change',
          entityType: 'Student',
          entityId: studentId,
          summary: `manual payment ${saved.id}: balance ${before} → ${before + lessonsAdded}`,
        });
      }

      return paymentToRecord(saved);
    });
  }

  async update(id: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.dataSource.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(PaymentEntity);
      const studentRepo = manager.getRepository(StudentEntity);

      const row = await paymentRepo.findOne({ where: { id } });
      if (!row) {
        throw new NotFoundException('Payment not found');
      }

      const previousLessons = row.lessonsAdded ?? 0;
      const wasBalanceApplied = this.shouldApplyBalance(row);

      Object.assign(row, recordToPaymentPayload(input));
      if (input.comment !== undefined) {
        row.notes = String(input.comment);
      }
      row.updatedDate = new Date();

      const saved = await paymentRepo.save(row);
      const nowApplies = this.shouldApplyBalance(saved);

      if (wasBalanceApplied || nowApplies) {
        const previousEffect = wasBalanceApplied ? previousLessons : 0;
        const nextEffect = nowApplies ? (saved.lessonsAdded ?? 0) : 0;
        const delta = nextEffect - previousEffect;
        if (delta !== 0) {
          await this.applyBalanceDelta(manager, saved.studentId, delta);
        }
      }

      return paymentToRecord(saved);
    });
  }

  async delete(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(PaymentEntity);
      const row = await paymentRepo.findOne({ where: { id } });
      if (!row) {
        throw new NotFoundException('Payment not found');
      }

      if (this.shouldApplyBalance(row)) {
        await this.applyBalanceDelta(manager, row.studentId, -(row.lessonsAdded ?? 0));
      }

      await paymentRepo.delete({ id });
    });
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
    packageType?: string | null;
    amount?: number;
  }> {
    return this.dataSource.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(PaymentEntity);
      const studentRepo = manager.getRepository(StudentEntity);
      const courseRepo = manager.getRepository(CourseEntity);

      const row = await paymentRepo
        .createQueryBuilder('payment')
        .setLock('pessimistic_write')
        .where('payment.order_number = :orderNumber', { orderNumber: params.orderNumber })
        .getOne();

      if (!row) {
        return { applied: false, notFound: true };
      }

      if (row.status === 'paid') {
        const student = await studentRepo.findOne({ where: { id: row.studentId } });
        return {
          applied: true,
          alreadyPaid: true,
          paymentId: row.id,
          student: student ?? undefined,
          lessonsAdded: row.lessonsAdded ?? 0,
          packageType: row.packageType,
          amount: Number(row.amount),
        };
      }

      const packageType = row.packageType;

      row.status = 'paid';
      row.paidAt = new Date();
      row.externalId = params.externalOrderId;
      row.notes = params.comment;
      row.updatedDate = new Date();
      await paymentRepo.save(row);

      await this.audit.log({
        action: 'payment_webhook',
        entityType: 'Payment',
        entityId: row.id,
        summary: `order ${params.orderNumber} paid via webhook (${packageType ?? 'unknown'})`,
      });

      const student = await studentRepo.findOne({ where: { id: row.studentId } });
      if (!student) {
        return { applied: true, paymentId: row.id, packageType };
      }

      if (this.isPackagePayment(packageType)) {
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
          packageType,
          amount: Number(row.amount),
        };
      }

      if (this.isCoursePayment(packageType)) {
        const courseType = this.resolveCourseType(packageType);
        const shopItemId = this.extractShopItemId(packageType);
        const marker = this.paymentCourseMarker(row.id);
        const existingCourse = await courseRepo.findOne({
          where: { studentId: row.studentId, notes: marker },
        });

        if (!existingCourse) {
          await courseRepo.save(
            courseRepo.create({
              id: randomUUID(),
              studentId: row.studentId,
              studentName: student.name,
              courseType,
              courseName: shopItemId ?? 'Курс',
              totalLessons: 35,
              completedLessons: 0,
              startDate: new Date().toISOString().split('T')[0],
              status: 'active',
              notes: marker,
              createdDate: new Date(),
              updatedDate: new Date(),
            }),
          );
        }

        return {
          applied: true,
          paymentId: row.id,
          student,
          packageType,
          amount: Number(row.amount),
        };
      }

      return { applied: true, paymentId: row.id, packageType };
    });
  }

  toRecord(row: PaymentEntity): Record<string, unknown> {
    return paymentToRecord(row);
  }

  private shouldApplyBalance(payment: PaymentEntity): boolean {
    return payment.status === 'paid' && this.isPackagePayment(payment.packageType);
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

    student.lessonBalance = Math.max(0, (student.lessonBalance ?? 0) + delta);
    student.updatedDate = new Date();
    return studentRepo.save(student);
  }
}
